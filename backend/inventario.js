const express = require('express');
const router = express.Router();
const { connection } = require('./connection');
const { parse } = require('json2csv');

// Ruta para obtener las sucursales
router.get('/obtenerSucursales', (req, res) => {
    const query = 'SELECT idSucursal, NombreSucursal FROM sucursales WHERE TipoSucursal >= 1 AND TipoSucursal <= 3 ORDER BY NombreSucursal';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los nombres de las sucursales:', err);
            return res.status(500).json({ error: 'Error al obtener los nombres de las sucursales' });
        }

        res.json(results);
    });
});

// AlmacÃ©n de datos generado en memoria por usuario
const reportCacheInventario = {};

// Ruta para generar el reporte
router.post('/generarReporteInventario', (req, res) => {
    const { sucursalBuscar } = req.body;
    const idProveedor = req.session.user ? req.session.user.IdProveedor : null;

    if (!idProveedor) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Umbral mÃ¡ximo de registros permitidos
    const MAX_RECORDS = 9000000; // Define el lÃ­mite mÃ¡ximo

    // Query para contar registros
    let countQuery = `
        SELECT COUNT(*) AS totalRecords
        FROM HistorialInventario
        WHERE IdProveedores = ?
    `;
    let queryParams = [idProveedor];

    if (sucursalBuscar) {
        countQuery += ` AND IdSucursal = ?`;
        queryParams.push(sucursalBuscar);
    }

    connection.query(countQuery, queryParams, (err, countResults) => {
        if (err) {
            console.error('Error al contar los registros:', err);
            return res.status(500).json({ error: 'Error al contar los registros' });
        }

        const totalRecords = countResults[0].totalRecords;

        if (totalRecords > MAX_RECORDS) {
            // Si los registros exceden el umbral, devolver un mensaje de error
            return res.status(413).json({
                error: 'El reporte es demasiado grande para ser procesado.',
                totalRecords,
                message: `El reporte contiene ${totalRecords} registros, lo cual excede el lÃ­mite permitido de ${MAX_RECORDS}. Por favor, ajuste los filtros para reducir el volumen de datos.`
            });
        }

        // Construir la consulta dinÃ¡mica
        let query = `
            SELECT 
                HistorialInventario.IdSucursal, 
                HistorialInventario.NombreSucursal, 
                HistorialInventario.Upc, 
                HistorialInventario.Descripcion, 
                HistorialInventario.Existencia, 
                DATE_FORMAT(HistorialInventario.FechaInventario, '%Y-%m-%d') as FechaInventario,
                HistorialInventario.departamentos AS Departamento,
                HistorialInventario.categorias AS Categoria,
                HistorialInventario.subcategorias AS SubCategoria,
                productospaquetes.Cantidad AS UnidadesPorFardo
            FROM 
                HistorialInventario
            LEFT JOIN 
                productospaquetes ON HistorialInventario.Upc = productospaquetes.UPC
            WHERE 
                HistorialInventario.IdProveedores = ?`;

        let queryParams = [idProveedor];

        if (sucursalBuscar) {
            query += ` AND HistorialInventario.IdSucursal = ?`;
            queryParams.push(sucursalBuscar);
        }

        connection.query(query, queryParams, (err, results) => {
            if (err) {
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).json({ error: 'Error al generar el reporte' });
            }

            // Extraer datos Ãºnicos para los selectores
            const sucursales = [...new Set(results.map(row => ({ id: row.IdSucursal, nombre: row.NombreSucursal })))];
            const departamentos = [...new Set(results.map(row => row.Departamento))].filter(Boolean);
            const categorias = [...new Set(results.map(row => row.Categoria))].filter(Boolean);
            const subcategorias = [...new Set(results.map(row => row.SubCategoria))].filter(Boolean);

            // Almacenar los datos en cachÃ© para el usuario actual
            reportCacheInventario[req.session.IdUsuarioP] = results;

            res.json({
                totalRecords: results.length,
                selectores: {
                    sucursales,
                    departamentos,
                    categorias,
                    subcategorias
                }
            });
        });
    });
});


// Ruta para paginar la informacion y mandarla al cliente
router.post('/getPaginatedData', (req, res) => {
    const { page, pageSize, search, order, columns } = req.body;

    // Datos originales generados previamente (cachÃ©)
    const userId = req.session.IdUsuarioP;
    if (!reportCacheInventario[userId]) {
        return res.status(404).json({ error: 'No se encontrÃ³ un reporte generado para este usuario' });
    }

    // Siempre trabajar con una copia fresca de los datos originales
    let data = [...reportCacheInventario[userId]];

    // Aplicar bÃºsqueda
    if (search && search.value) {
        const searchTerm = search.value.toLowerCase();
        data = data.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(searchTerm)
            )
        );
    }

    // Aplicar ordenamiento
    if (order && order.length > 0) {
        const columnIdx = order[0].column; // Ãndice de la columna
        const dir = order[0].dir === 'asc' ? 1 : -1; // DirecciÃ³n del ordenamiento
        const columnName = columns[columnIdx].data; // Nombre de la columna

        data = data.sort((a, b) => {
            const valA = isNaN(a[columnName]) ? a[columnName] : Number(a[columnName]);
            const valB = isNaN(b[columnName]) ? b[columnName] : Number(b[columnName]);
        
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
        
    }

    // PaginaciÃ³n
    const totalRecords = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedData = data.slice(start, end);

    res.json({
        data: paginatedData,
        totalRecords
    });
});

// Ruta para filtrar los datos 
router.post('/filtrarDatos', (req, res) => {
    const { sucursal, departamento, categoria, subcategoria, searchTerm, searchUPC } = req.body;

    const userId = req.session.IdUsuarioP;
    if (!reportCacheInventario[userId]) {
        return res.status(404).json({ error: 'No se encontrÃ³ un reporte generado para este usuario' });
    }

    let data = [...reportCacheInventario[userId]];

    // Filtrar por descripciÃ³n (searchTerm)
    if (searchTerm) {
        const searchWords = searchTerm.toLowerCase().split(/\s+/);
        data = data.filter(row => {
            const descripcion = row.Descripcion ? row.Descripcion.toLowerCase() : '';
            return searchWords.every(word => descripcion.includes(word));
        });
    }

    // Aplicar filtros adicionales (sucursal, departamento, categorÃ­a, subcategorÃ­a)
    if (sucursal) {
        data = data.filter(row => String(row.IdSucursal) === String(sucursal));
    }
    if (departamento) {
        data = data.filter(row => row.Departamento === departamento);
    }
    if (categoria) {
        data = data.filter(row => row.Categoria === categoria);
    }
    if (subcategoria) {
        data = data.filter(row => row.SubCategoria === subcategoria);
    }

    // Generar datos Ãºnicos para los selectores
    const sucursales = Array.from(new Map(data.map(row => [row.IdSucursal, { id: row.IdSucursal, nombre: row.NombreSucursal }])).values());
    const departamentos = [...new Set(data.map(row => row.Departamento))].filter(Boolean);
    const categorias = [...new Set(data.map(row => row.Categoria))].filter(Boolean);
    const subcategorias = [...new Set(data.map(row => row.SubCategoria))].filter(Boolean);

    res.json({
        data: Array.isArray(data) ? data : [],
        selectores: {
            sucursales: Array.isArray(sucursales) ? sucursales : [],
            departamentos: Array.isArray(departamentos) ? departamentos : [],
            categorias: Array.isArray(categorias) ? categorias : [],
            subcategorias: Array.isArray(subcategorias) ? subcategorias : []
        }
    });
});

// Ruta para calcular los totales
router.post('/calcularTotales', (req, res) => {
    const userId = req.session.IdUsuarioP;

    // Verificar si hay datos en cachÃ© para el usuario
    if (!reportCacheInventario[userId]) {
        return res.status(404).json({ error: 'No se encontrÃ³ un reporte generado para este usuario' });
    }

    const { sucursal, departamento, categoria, subcategoria, searchTerm } = req.body;
    let data = [...reportCacheInventario[userId]];

    // Aplicar filtros
    if (sucursal) {
        data = data.filter(item => String(item.IdSucursal) === String(sucursal));
    }
    if (departamento) {
        data = data.filter(item => item.Departamento === departamento);
    }
    if (categoria) {
        data = data.filter(item => item.Categoria === categoria);
    }
    if (subcategoria) {
        data = data.filter(item => item.SubCategoria === subcategoria);
    }
    if (searchTerm) {
        data = data.filter(item =>
            item.Descripcion && item.Descripcion.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Calcular los totales
    const sucursalTotales = {};
    const departamentoTotales = {};
    const categoriaTotales = {};
    const subcategoriaTotales = {};

    data.forEach(item => {
        const Existencia = parseFloat(item.Existencia) || 0;

        if (item.NombreSucursal) {
            sucursalTotales[item.NombreSucursal] = (sucursalTotales[item.NombreSucursal] || 0) + Existencia;
        }
        if (item.Departamento) {
            departamentoTotales[item.Departamento] = (departamentoTotales[item.Departamento] || 0) + Existencia;
        }
        if (item.Categoria) {
            categoriaTotales[item.Categoria] = (categoriaTotales[item.Categoria] || 0) + Existencia;
        }
        if (item.SubCategoria) {
            subcategoriaTotales[item.SubCategoria] = (subcategoriaTotales[item.SubCategoria] || 0) + Existencia;
        }
    });

    res.json({
        sucursalTotales,
        departamentoTotales,
        categoriaTotales,
        subcategoriaTotales
    });
});

// Ruta para exportar todos los datos
router.get('/exportarTodo', (req, res) => {
    const userId = req.session.IdUsuarioP;
    if (!reportCacheInventario[userId]) {
        return res.status(404).json({ error: 'No se encontraron datos para exportar.' });
    }
    
    // Hacer una copia de los datos para no modificar los originales
    const dataToExport = reportCacheInventario[userId].map(item => {
        // Crear un nuevo objeto con los mismos valores
        const newItem = {...item};
        
        // Convertir UPC a formato de texto con comillas
        if (newItem.Upc !== undefined && newItem.Upc !== null) {
            newItem.Upc = `="${newItem.Upc}"`;
        }
        
        // Convertir UnidadesPorFardo a formato de texto si es necesario
        if (newItem.UnidadesPorFardo !== undefined && newItem.UnidadesPorFardo !== null) {
            newItem.UnidadesPorFardo = `="${newItem.UnidadesPorFardo}"`;
        }
        
        return newItem;
    });
    
    const fields = ["NombreSucursal", "Upc", "Descripcion", "Existencia", "Fecha", "Departamento", "Categoria", "SubCategoria", "UnidadesPorFardo"];
    
    try {
        const csv = parse(dataToExport, { fields }); // Usa json2csv para crear el archivo CSV
        // Crear el nombre del archivo con las fechas
        const fileName = `ReporteInventarioGeneral.csv`;
        res.header('Content-Type', 'text/csv');
        res.attachment(fileName); // Usar el nombre del archivo con fechas
        res.send(csv);
    } catch (err) {
        console.error('Error al generar el CSV:', err);
        res.status(500).send('Error al generar el archivo CSV');
    }
});

// Ruta para exportar datos filtrados
router.post('/exportarFiltrado', (req, res) => {
    const { sucursal, departamento, categoria, subcategoria, searchTerm } = req.body;
    const userId = req.session.IdUsuarioP;
    
    if (!reportCacheInventario[userId]) {
        return res.status(404).json({ error: 'No se encontraron datos para exportar.' });
    }
    
    let data = [...reportCacheInventario[userId]];
    
    // Aplicar filtros
    if (sucursal) data = data.filter(row => row.IdSucursal == sucursal);
    if (departamento) data = data.filter(row => row.Departamento === departamento);
    if (categoria) data = data.filter(row => row.Categoria === categoria);
    if (subcategoria) data = data.filter(row => row.SubCategoria === subcategoria);
    if (searchTerm) {
        const searchWords = searchTerm.toLowerCase().split(/\s+/);
        data = data.filter(row => searchWords.every(word => (row.Descripcion || '').toLowerCase().includes(word)));
    }
    
    // Convertir UPC y UnidadesPorFardo a formato de texto para Excel
    const dataToExport = data.map(item => {
        // Crear un nuevo objeto con los mismos valores
        const newItem = {...item};
        
        // Convertir UPC a formato de texto con comillas
        if (newItem.Upc !== undefined && newItem.Upc !== null) {
            newItem.Upc = `="${newItem.Upc}"`;
        }
        
        // Convertir UnidadesPorFardo a formato de texto si es necesario
        if (newItem.UnidadesPorFardo !== undefined && newItem.UnidadesPorFardo !== null) {
            newItem.UnidadesPorFardo = `="${newItem.UnidadesPorFardo}"`;
        }
        
        return newItem;
    });
    
    const fields = ["NombreSucursal", "Upc", "Descripcion", "Existencia", "Fecha", "Departamento", "Categoria", "SubCategoria", "UnidadesPorFardo"];
    
    try {
        const csv = parse(dataToExport, { fields });
        // Construir el nombre del archivo dinámicamente
        const fileName = `ReporteInventarioFiltrado.csv`;
        res.header('Content-Type', 'text/csv');
        res.attachment(fileName);
        res.send(csv);
    } catch (err) {
        console.error('Error al generar el CSV filtrado:', err);
        res.status(500).send('Error al generar el archivo CSV');
    }
});


// Ruta para limpiar toda la informacion
router.post('/limpiarReporteInventario', (req, res) => {
    const userId = req.session && req.session.user ? req.session.IdUsuarioP : null;

    if (!userId) {
        // Eliminar todas las propiedades del objeto reportCache
        Object.keys(reportCacheInventario).forEach(key => delete reportCacheInventario[key]);
        return res.json({ message: 'Variable reportCache limpiada para todos los usuarios.' });
    }

    if (reportCacheInventario[userId]) {
        delete reportCacheInventario[userId]; // Eliminar solo los datos del usuario actual
        return res.json({ message: `Datos limpiados correctamente para el usuario ${userId}.` });
    } else {
        return res.json({ message: `No hay datos para limpiar para el usuario ${userId}.` });
    }
});

// Ruta para obtener los detalles de la sucursal
router.get('/detalleSucursal', (req, res) => {
    const nombreSucursal = req.query.nombre;

    if (!nombreSucursal) {
        return res.status(400).json({ error: 'Nombre de la sucursal no proporcionado' });
    }

    const query = `
        SELECT TipoSucursal, Descripcion, Imagen, Ubicacion 
        FROM sucursales_info 
        WHERE IdSucursal = ?
    `;

    connection.query(query, [nombreSucursal], (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        // Convertir la imagen a Base64 si es necesario
        if (results[0].Imagen) {
            results[0].Imagen = results[0].Imagen.toString('base64');
        }

        res.json(results[0]);
    });
});
module.exports = router;
