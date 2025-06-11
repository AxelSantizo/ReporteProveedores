document.addEventListener('DOMContentLoaded', function() { 
    // Variable global para el prefijo de ruta
    const basePath = '/RProveedor/';

    // Obtener la fecha de hoy en formato YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0]; 
    document.getElementById('FechaFinal').value = today;

    // Crear una nueva fecha y restar un dÃ­a para FechaInicio
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = yesterday.toISOString().split('T')[0]; 

    // Asignar la fecha de inicio (un dÃ­a antes) al campo de FechaInicio
    document.getElementById('FechaInicio').value = formattedYesterday;

    // FunciÃ³n para mostrar cuadros de diÃ¡logo con SweetAlert2
    function showAlert(title, text, icon = 'info') {
        Swal.fire({
            title: title,
            html: text,
            icon: icon,
            confirmButtonText: 'OK'
        });
    }

    // FunciÃ³n para mostrar el spinner
    function showSpinner() {
        Swal.fire({
            title: 'Cargando, porfavor espere!',
            html: '<div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div>',
            showConfirmButton: false,
            allowOutsideClick: false,  // Deshabilitar clic fuera
            allowEscapeKey: false,     // Deshabilitar tecla Escape
            backdrop: true,            // Mantener el fondo oscuro
            didOpen: () => {
                // AquÃ­ puedes agregar cualquier lÃ³gica adicional cuando el spinner se muestre
            }
        });
    }
    
    // FunciÃ³n para ocultar el spinner
    function hideSpinner() {
        Swal.close();
    }

    // FunciÃ³n para obtener los nombres de las sucursales
    function fetchSucursales() {
        fetch(`${basePath}backend/obtenerSucursales`)
            .then(response => response.json())
            .then(data => {
                const sucursalesSelect = document.getElementById('sucursalBusqueda');
                sucursalesSelect.innerHTML = '<option value="">Reporte General</option>'; // OpciÃ³n por defecto

                data.forEach(sucursal => {
                    const option = document.createElement('option');
                    option.value = sucursal.idSucursal; // Valor del select serÃ¡ idSucursal
                    option.textContent = sucursal.NombreSucursal; // Texto visible serÃ¡ NombreSucursal
                    sucursalesSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error al obtener los nombres de las sucursales:', error);
                showAlert('Error', 'Hubo un error al obtener los nombres de las sucursales.', 'error');
            });
    }
    fetchSucursales();

    function validarFechas() {
        const fechaInicioInput = document.getElementById('FechaInicio');
        const fechaFinalInput = document.getElementById('FechaFinal');
    
        const fechaInicio = new Date(fechaInicioInput.value);
        const fechaFinal = new Date(fechaFinalInput.value);
    
        if (!fechaInicioInput.value || !fechaFinalInput.value) {
            Swal.fire({
                title: 'Fechas incompletas',
                text: 'Debes seleccionar ambas fechas.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return false;
        }
    
        if (fechaInicio > fechaFinal) {
            Swal.fire({
                title: 'Fechas inválidas',
                text: 'La fecha inicial no puede ser mayor que la fecha final.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return false;
        }
    
        // Calcular diferencia en meses
        const diferenciaMeses = (fechaFinal.getFullYear() - fechaInicio.getFullYear()) * 12 + (fechaFinal.getMonth() - fechaInicio.getMonth());
    
        if (diferenciaMeses > 2 || (diferenciaMeses === 2 && fechaFinal.getDate() > fechaInicio.getDate())) {
            Swal.fire({
                title: 'Reporte Extenso',
                text: 'Solo puedes generar reportes de hasta 2 meses.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return false;
        }
    
        return true;
    }    

    document.getElementById('reporte').addEventListener('click', function() {
        if (validarFechas()) {
            generarReporte('agrupado');
        }
    });
    
    document.getElementById('reporteDetallado').addEventListener('click', function() {
        if (validarFechas()) {
            generarReporte('detallado');
        }
    });    
    
    let globalResetData; 

    function generarReporte(tipoReporte) {
        const sucursalBuscar = document.getElementById('sucursalBusqueda').value;
        const fechaInicio = document.getElementById('FechaInicio').value;
        const fechaFin = document.getElementById('FechaFinal').value;
    
        if (fechaInicio === '' || fechaFin === '') {
            showAlert('Error', 'Debe seleccionar una fecha de inicio y una fecha de fin.', 'error');
            return;
        } else if (fechaInicio > fechaFin) {
            showAlert('Error', 'La fecha de inicio no puede ser mayor a la fecha de fin.', 'error');
            return;
        }
    
        // Mostrar el spinner
        showSpinner();
    
        const url = `${basePath}backend/generarReporte`;
        const requestBody = {
            fechaInicio,
            fechaFin,
            sucursalBuscar: sucursalBuscar === '' ? null : sucursalBuscar,
            tipoReporte // 'agrupado' o 'detallado'
        };
    
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    const errorMessage = errorData.error || 'Error al generar el reporte';
                    throw new Error(errorMessage);
                });
            }
            return response.json(); // Recibir el nÃºmero total de registros desde el backend
        })
        .then(result => {
            // Verificar si hay registros
            if (result.totalRecords === 0) {
                showAlert('InformaciÃ³n', 'No se encontrÃ³ informaciÃ³n para los criterios seleccionados.', 'info');
                return;
            }
            // Llenar los selectores con los datos necesarios
            llenarSelectores(result.selectores);
    
            // Calcula los totales para las grÃ¡ficas
            obtenerTotales();

            // Actualizar la tabla con los datos del reporte
            updateTable(result.totalRecords, tipoReporte, sucursalBuscar, fechaInicio, fechaFin);
    
            // Crear resetData como una funciÃ³n global para restablecer datos
            globalResetData = function () {
                setTimeout(() => {
                    llenarSelectores(result.selectores);
                    obtenerTotales();
                    updateTable(result.totalRecords, tipoReporte, sucursalBuscar, fechaInicio, fechaFin);
                }, 500);
            };
        })
        .catch(error => {
            console.error('Error al generar el reporte:', error);
            showAlert('Error', error.message, 'error');
        })
        .finally(() => {
        });
    }
    
    
    // Evento para el boton quitarFiltro
    document.getElementById('quitarfiltro').addEventListener('click', function() {    
        showSpinner();
        // Restablecer los selectores a la opciÃ³n predeterminada y deja los campos vacios
        document.getElementById('sucursalFiltro').selectedIndex = 0;
        document.getElementById('departamentoFiltro').selectedIndex = 0;
        document.getElementById('categoriaFiltro').selectedIndex = 0;
        document.getElementById('subcategoriaFiltro').selectedIndex = 0;
        document.getElementById('descProduc').value = '';
        document.getElementById('descProduc').innerText = '';
        document.getElementById('viewBE').style.display = 'none';
        document.getElementById('quitarfiltro').style.display = 'none';
        document.getElementById('exportar').style.display = 'block';

        if (globalResetData) {
            globalResetData();
        }
    });

    function updateTable(totalRecords, tipoReporte, sucursalBuscar, fechaInicio, fechaFin) {
        // Destruir cualquier instancia previa de DataTables para evitar conflictos
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            $('#dataTable').DataTable().clear().destroy();
        }
    
        // Configurar DataTables para manejar datos dinÃ¡micos con paginaciÃ³n
        $('#dataTable').DataTable({
            serverSide: true,
            responsive: true,
            autoWidth: false,
            ajax: function (data, callback) {
                // Calcular la pÃ¡gina actual y el tamaÃ±o de la pÃ¡gina
                const page = (data.start / data.length) + 1;
                const pageSize = data.length;
        
                const url = `${basePath}backend/getPaginatedData`;
                const requestBody = {
                    page,
                    pageSize,
                    search: data.search, // BÃºsqueda enviada por DataTables
                    order: data.order,   // Ordenamiento enviado por DataTables
                    columns: data.columns // Columnas visibles enviadas por DataTables
                };
        
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Error al obtener datos paginados');
                        }
                        return response.json();
                    })
                    .then(result => {
                        callback({
                            draw: data.draw,
                            recordsTotal: result.totalRecords,
                            recordsFiltered: result.totalRecords,
                            data: result.data // Datos de la pÃ¡gina actual
                        });
                    })
                    .catch(error => {
                        console.error('Error al obtener datos paginados:', error);
                        showAlert('Error', 'Hubo un problema al cargar los datos.', 'error');
                    });
            },
            columns: [
                {
                    data: 'NombreSucursal',
                    render: function (data, type, row) {
                        return `
                            <button 
                                class="btn-nombre-sucursal" 
                                data-id="${row.IdSucursal}" 
                                data-nombre="${row.NombreSucursal}" 
                                style="background-color: transparent; border: none; color: inherit; cursor: pointer; text-decoration: none;">
                                ${data || 'Sin Nombre'}
                            </button>`;
                    }
                },
                { data: 'Upc' },
                { data: 'Descripcion' },
                { data: 'Cantidad' },
                { data: 'MontoTotal' },
                { data: 'Departamento' },
                { data: 'Categoria' },
                { data: 'SubCategoria' },
                { data: 'UnidadesPorFardo' },
                {
                    data: 'Fecha',

                    render: function (data, type, row) {
                    if (!data) return '';
                    
                    // Solución: mantener la fecha exactamente como viene de la base de datos
                    // Si la fecha viene como '2025-03-03', simplemente formatearla como '2025/03/03'
                    if (typeof data === 'string') {
                        // Asumimos que data es una cadena de fecha (puede ser '2025-03-03' o '2025-03-03T00:00:00.000Z')
                        const fechaParts = data.split('T')[0].split('-');
                        if (fechaParts.length === 3) {
                            return `${fechaParts[0]}/${fechaParts[1]}/${fechaParts[2]}`;
                        }
                    }
                    
                    // Respaldo por si la fecha viene en otro formato
                    const date = new Date(data);
                    // Usar toISOString y tomar solo la parte de la fecha
                    const isoDate = date.toISOString().split('T')[0].split('-');
                    return `${isoDate[0]}/${isoDate[1]}/${isoDate[2]}`;
                }  
                }
            ],
            processing: true,
            lengthChange: false,
            searching: false,
            pageLength: 100,
            lengthMenu: [100, 200, 500],
            language: {
                paginate: {
                    next: 'Siguiente',
                    previous: 'Anterior'
                },
                search: "Buscar por UPC:",
                lengthMenu: "Mostrar _MENU_ registros por pÃ¡gina",
                info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
                infoEmpty: "Mostrando 0 a 0 de 0 registros",
                infoFiltered: "(filtrado de _MAX_ registros totales)"
            },
            initComplete: function () {
                hideSpinner();
                document.getElementById('Busqueda').style.display = 'none';
                document.getElementById('Filtros').style.display = 'block';
            }
        });
    }

    // Delegar el evento click a un elemento contenedor (tbody)
    $('#dataTable tbody').on('click', '.btn-nombre-sucursal', function () {
        const button = $(this);
        const id = button.data('id');
        const nombre = button.data('nombre');
    
        // Actualizar el modal con la informaciÃ³n seleccionada
        document.getElementById('tituloSucursal').innerText = nombre;
        document.getElementById('tituloSucursal').value = id;
    
        // Fetch al backend para obtener mÃ¡s detalles
        fetch(`${basePath}backend/detalleSucursal?nombre=${encodeURIComponent(id)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('No se encontrÃ³ la sucursal.');
                }
                return response.json();
            })
            .then(data => {
                // Verificar si hay datos relevantes
                if (!data || (!data.TipoSucursal && !data.Descripcion && !data.Imagen && !data.Ubicacion)) {
                    document.getElementById('viewInfo').style.display = 'none';
                    document.getElementById('viewInfoError').style.display = 'block';
                } else {
                    document.getElementById('viewInfo').style.display = 'block';
                    document.getElementById('viewInfoError').style.display = 'none';
    
                    // Actualizar los campos del modal con los datos obtenidos
                    document.getElementById('tipoTienda').innerText = data.TipoSucursal || 'No disponible';
                    document.getElementById('descSucursal').innerText = data.Descripcion || 'No disponible';
    
                    if (data.Imagen) {
                        document.getElementById('imagenSucursal').src = `data:image/jpeg;base64,${data.Imagen}`;
                    } else {
                        document.getElementById('imagenSucursal').src = ''; // Imagen predeterminada o vacÃ­o
                    }
    
                    document.getElementById('ubicacionLink').href = data.Ubicacion || '#'; // Enlace de ubicaciÃ³n
                }
    
                // Mostrar el modal usando Bootstrap
                const modal = new bootstrap.Modal(document.getElementById('modalInfo'));
                modal.show();
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('viewInfo').style.display = 'none';
                document.getElementById('viewInfoError').style.display = 'block';
    
                // Mostrar el modal con el mensaje de error
                const modal = new bootstrap.Modal(document.getElementById('modalInfo'));
                modal.show();
            });
    });

    // Funcion para llenar los selectores con la informacion en la tabla 
    function llenarSelectores(selectores) {
        const { sucursales, departamentos, categorias, subcategorias } = selectores;
    
        // 1. Sucursales
        const sucursalFiltro = document.getElementById('sucursalFiltro');
        sucursalFiltro.innerHTML = `<option value="">Todas las sucursales</option>`; // OpciÃ³n predeterminada
        // Usar Map para obtener sucursales Ãºnicas
        const sucursalesUnicas = Array.from(new Map(
            (sucursales || []).map(sucursal => [sucursal.id, sucursal]) // Usar ID como clave
        ).values());
        sucursalesUnicas.forEach(sucursal => {
            const option = document.createElement('option');
            option.value = sucursal.id;
            option.textContent = sucursal.nombre;
            sucursalFiltro.appendChild(option);
        });
    
        // 2. Departamentos
        const departamentoFiltro = document.getElementById('departamentoFiltro');
        departamentoFiltro.innerHTML = `<option value="">Todos los departamentos</option>`;
        // Usar Set para eliminar duplicados en departamentos
        const departamentosUnicos = [...new Set(departamentos || [])];
        departamentosUnicos.forEach(departamento => {
            const option = document.createElement('option');
            option.value = departamento;
            option.textContent = departamento;
            departamentoFiltro.appendChild(option);
        });
    
        // 3. CategorÃ­as
        const categoriaFiltro = document.getElementById('categoriaFiltro');
        categoriaFiltro.innerHTML = `<option value="">Todas las categorías</option>`;
        // Usar Set para eliminar duplicados en categorÃ­as
        const categoriasUnicas = [...new Set(categorias || [])];
        categoriasUnicas.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            categoriaFiltro.appendChild(option);
        });
    
        // 4. SubcategorÃ­as
        const subcategoriaFiltro = document.getElementById('subcategoriaFiltro');
        subcategoriaFiltro.innerHTML = `<option value="">Todas las subcategorías</option>`;
        // Usar Set para eliminar duplicados en subcategorÃ­as
        const subcategoriasUnicas = [...new Set(subcategorias || [])];
        subcategoriasUnicas.forEach(subcategoria => {
            const option = document.createElement('option');
            option.value = subcategoria;
            option.textContent = subcategoria;
            subcategoriaFiltro.appendChild(option);
        });
    }
    
    // Evento para el selector de sucursal
    document.getElementById('sucursalFiltro').addEventListener('change', function() {
        reiniciarFiltro('departamentoFiltro');
        reiniciarFiltro('categoriaFiltro');
        reiniciarFiltro('subcategoriaFiltro');
        actualizarInformacion();
    });
    
    // Evento para el selector de departamento
    document.getElementById('departamentoFiltro').addEventListener('change', function() {
        reiniciarFiltro('categoriaFiltro');
        reiniciarFiltro('subcategoriaFiltro');
        actualizarInformacion();
    });
    
    // Evento para el selector de categoria
    document.getElementById('categoriaFiltro').addEventListener('change', function() {
        reiniciarFiltro('subcategoriaFiltro');
        actualizarInformacion();
    });
    
    // Evento para el selector de subcategoria
    document.getElementById('subcategoriaFiltro').addEventListener('change', function() {
        actualizarInformacion();
    });
    
    // FunciÃ³n para reiniciar un filtro al valor "Todos"s
    function reiniciarFiltro(filtroId) {
        const filtro = document.getElementById(filtroId);
        if (filtro) {
            filtro.innerHTML = '<option value="">Todos</option>'; // Asegurar opciÃ³n "Todos"
            filtro.value = ""; // Seleccionar "Todos" por defecto
        } else {
            console.error(`No se encontrÃ³ el filtro con ID "${filtroId}"`);
        }
    }

    // FunciÃ³n para filtrar por descripcion
    document.getElementById('descProduc').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') { // Comprobar si la tecla presionada es Enter
            const searchTerm = this.value.toLowerCase();

            if (searchTerm === '') {
                document.getElementById('quitarfiltro').style.display = 'none';
                document.getElementById('viewBE').style.display = 'none';
                document.getElementById('exportar').style.display = 'block';
            } else {
                document.getElementById('quitarfiltro').style.display = 'block';
                document.getElementById('viewBE').style.display = 'block';
                document.getElementById('exportar').style.display = 'none';
            }

            // Llamar a actualizarInformacion para aplicar todos los filtros (incluyendo descripciÃ³n)
            actualizarInformacion();
        }
    });
    
    // Funcion para actualizar informacion en base a filtros
    function actualizarInformacion() {
        const sucursalFiltro = document.getElementById('sucursalFiltro');
        const departamentoFiltro = document.getElementById('departamentoFiltro');
        const categoriaFiltro = document.getElementById('categoriaFiltro');
        const subcategoriaFiltro = document.getElementById('subcategoriaFiltro');
        const descripcionInput = document.getElementById('descProduc');
    
        const sucursal = sucursalFiltro.value || null;
        const departamento = departamentoFiltro.value || null;
        const categoria = categoriaFiltro.value || null;
        const subcategoria = subcategoriaFiltro.value || null;
        const searchTerm = descripcionInput.value.trim() || null;

        // Check if all filters are null
        if (!sucursal && !departamento && !categoria && !subcategoria && !searchTerm) {
            // Use globalResetData if it exists
            if (typeof globalResetData === 'function') {
                globalResetData();
                return;
            }
        }
    
        showSpinner();
    
        fetch(`${basePath}backend/filtrarDatos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sucursal, departamento, categoria, subcategoria, searchTerm })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al filtrar los datos');
            }
            return response.json();
        })
        .then(result => {
            // Si no hay datos en la respuesta, mostrar alerta y detener la ejecuciÃ³n
            if (!result.data || result.data.length === 0) {
                showAlert('Sin resultados', 'No hay informaciÃ³n disponible para los filtros aplicados.', 'info');
                return;
            }
            const valoresSeleccionados = { sucursal, departamento, categoria, subcategoria };

            // Actualizar los selectores con los datos Ãºnicos generados
            updateSelectors(result.selectores, valoresSeleccionados);

            // Calcular los nuevos totales basados en los datos filtrados
            obtenerTotales();

            verButtonFiltro();

            // Actualizar la tabla con los datos filtrados
            updateTableFiltered(result.data);
        })
        .catch(error => {
            console.error('Error al filtrar los datos:', error);
            showAlert('Error', 'Hubo un problema al aplicar los filtros.', 'error');
        })
        .finally();
    }
    
    // Funcion para actualizar los selectores con datos filtrados
    function updateSelectors(selectores, valoresSeleccionados = {}) {
        const { sucursal: sucursalSeleccionada = "", departamento: departamentoSeleccionado = "", categoria: categoriaSeleccionada = "", subcategoria: subcategoriaSeleccionada = "" } = valoresSeleccionados;
    
        // Llena el selector de sucursales
        const selectorSucursal = document.getElementById('sucursalFiltro');
        selectorSucursal.innerHTML = '<option value="">Todas las sucursales</option>';
        selectores.sucursales.forEach(sucursal => {
            const option = document.createElement('option');
            option.value = sucursal.id;
            option.textContent = sucursal.nombre;
            selectorSucursal.appendChild(option);
        });
        selectorSucursal.value = sucursalSeleccionada || ""; // Mantener selecciÃ³n actual
    
        // Llena el selector de departamentos
        const selectorDepartamento = document.getElementById('departamentoFiltro');
        selectorDepartamento.innerHTML = '<option value="">Todos los departamentos</option>';
        selectores.departamentos.forEach(departamento => {
            const option = document.createElement('option');
            option.value = departamento;
            option.textContent = departamento;
            selectorDepartamento.appendChild(option);
        });
        selectorDepartamento.value = departamentoSeleccionado || ""; // Reinicia siempre con "Todos"
    
        // Llena el selector de categorÃ­as
        const selectorCategoria = document.getElementById('categoriaFiltro');
        selectorCategoria.innerHTML = '<option value="">Todas las categorÃ­as</option>';
        selectores.categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            selectorCategoria.appendChild(option);
        });
        selectorCategoria.value = categoriaSeleccionada || ""; // Reinicia siempre con "Todas"
    
        // Llena el selector de subcategorÃ­as
        const selectorSubCategoria = document.getElementById('subcategoriaFiltro');
        selectorSubCategoria.innerHTML = '<option value="">Todas las subcategorÃ­as</option>';
        selectores.subcategorias.forEach(subcategoria => {
            const option = document.createElement('option');
            option.value = subcategoria;
            option.textContent = subcategoria;
            selectorSubCategoria.appendChild(option);
        });
        selectorSubCategoria.value = subcategoriaSeleccionada || ""; // Reinicia siempre con "Todas"
    }
    
    // Funcion para actualizar la tabla con los datos filtrados
    function updateTableFiltered(data) {
        // Destruir cualquier instancia previa de DataTables para evitar conflictos
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            $('#dataTable').DataTable().clear().destroy();
        }
    
        // Inicializar DataTables con los datos filtrados
        $('#dataTable').DataTable({
            data: data,
            columns: [
                {
                    data: 'NombreSucursal',
                    render: function (data, type, row) {
                        return `
                            <button 
                                class="btn-nombre-sucursal" 
                                data-id="${row.IdSucursal}" 
                                data-nombre="${row.NombreSucursal}" 
                                style="background-color: transparent; border: none; color: inherit; cursor: pointer; text-decoration: none;">
                                ${data || 'Sin Nombre'}
                            </button>`;
                    }
                },
                { data: 'Upc' },
                { data: 'Descripcion' },
                { data: 'Cantidad' },
                { data: 'MontoTotal' },
                { data: 'Departamento' },
                { data: 'Categoria' },
                { data: 'SubCategoria' },
                { data: 'UnidadesPorFardo' },
                {
                    data: 'Fecha',

                    render: function (data, type, row) {
                    if (!data) return '';
  
                    if (typeof data === 'string') {
                        const fechaParts = data.split('T')[0].split('-');
                        if (fechaParts.length === 3) {
                            return `${fechaParts[0]}/${fechaParts[1]}/${fechaParts[2]}`;
                        }
                    }
                    
                    const date = new Date(data);
                    const isoDate = date.toISOString().split('T')[0].split('-');
                    return `${isoDate[0]}/${isoDate[1]}/${isoDate[2]}`;
                }  
                }
            ],
            processing: true,
            lengthChange: false,
            searching: false,
            pageLength: 100,
            lengthMenu: [100, 200, 500],
            language: {
                paginate: {
                    next: 'Siguiente',
                    previous: 'Anterior'
                },
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_ registros por pÃ¡gina",
                info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
                infoEmpty: "Mostrando 0 a 0 de 0 registros",
                infoFiltered: "(filtrado de _MAX_ registros totales)"
            },
            initComplete: function () {
                hideSpinner();
            }
        });
    }
    
    function verButtonFiltro() {
        const searchTerm = document.getElementById('descProduc').value.toLowerCase();
    
        // Verificar si hay algÃºn filtro aplicado para mostrar el botÃ³n "quitar filtro"
        const sucursal = document.getElementById('sucursalFiltro').value;
        const departamento = document.getElementById('departamentoFiltro').value;
        const categoria = document.getElementById('categoriaFiltro').value;
        const subcategoria = document.getElementById('subcategoriaFiltro').value;
    
        if (sucursal || departamento || categoria || subcategoria || searchTerm) {
            document.getElementById('quitarfiltro').style.display = 'block';
            document.getElementById('viewBE').style.display = 'block';
            document.getElementById('exportar').style.display = 'none';
        } else {
            document.getElementById('quitarfiltro').style.display = 'none';
            document.getElementById('viewBE').style.display = 'none';
            document.getElementById('exportar').style.display = 'block';
            updateTable(); // Actualizar la tabla con todos los datos si no hay filtros
        }
    }

    // Definir las variables de totales globalmente
    let sucursalTotales = {};
    let departamentoTotales = {};
    let categoriaTotales = {};
    let subcategoriaTotales = {};

    // Funcion para calcular los totales para realizar las graficas
    function obtenerTotales() {
        const sucursal = document.getElementById('sucursalFiltro').value || null;
        const departamento = document.getElementById('departamentoFiltro').value || null;
        const categoria = document.getElementById('categoriaFiltro').value || null;
        const subcategoria = document.getElementById('subcategoriaFiltro').value || null;
        const searchTerm = document.getElementById('descProduc').value.trim() || null;

        fetch(`${basePath}backend/calcularTotales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sucursal, departamento, categoria, subcategoria, searchTerm }) // Incluir filtros aplicados
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al calcular los totales');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar las variables globales
            sucursalTotales = result.sucursalTotales;
            departamentoTotales = result.departamentoTotales;
            categoriaTotales = result.categoriaTotales;
            subcategoriaTotales = result.subcategoriaTotales;

            // Generar las grÃ¡ficas despuÃ©s de calcular los totales
            generarGraficas();
        })
        .catch(error => {
            console.error('Error al calcular los totales:', error);
            showAlert('Error', 'Hubo un problema al calcular los totales.', 'error');
        })
        .finally();
    }

    // Obtiene el tema actual para despues realizar las graficas en base al tema actual
    function obtenerTemaActual() {
        const temaActual = document.getElementById('themeStylesheet').getAttribute('href');
        return temaActual.includes('claro') ? 'claro' : 'oscuro';
    }

    // Genera las grÃ¡ficas en base a la informaciÃ³n de los totales y el tema actual
    function generarGraficas() {
        const temaActual = obtenerTemaActual();
        const crearGraficoPastel = temaActual === 'claro' ? crearGraficoDePastelClaro : crearGraficoDePastelOscuro;
        const crearGraficoBar = temaActual === 'claro' ? crearGraficoBarClaro : crearGraficoBarOscuro;

        google.charts.load('current', { 'packages': ['corechart'] });
        google.charts.setOnLoadCallback(() => {
            const totalSucursal = Object.values(sucursalTotales).reduce((a, b) => a + b, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const totalDepartamento = Object.values(departamentoTotales).reduce((a, b) => a + b, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const totalCategoria = Object.values(categoriaTotales).reduce((a, b) => a + b, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const totalSubcategoria = Object.values(subcategoriaTotales).reduce((a, b) => a + b, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            crearGraficoBar('ventasPorSucursal', Object.keys(sucursalTotales), Object.values(sucursalTotales), `Gráfica por Sucursal`);
            crearGraficoPastel('ventasPorDepartamento', Object.keys(departamentoTotales), Object.values(departamentoTotales), `Gráfica por Departamentos`);
            crearGraficoPastel('ventasPorCategoria', Object.keys(categoriaTotales), Object.values(categoriaTotales), `Gráfica por Categorías`);
            crearGraficoBar('ventasPorSubcategoria', Object.keys(subcategoriaTotales), Object.values(subcategoriaTotales), `Gráfica por SubCategorías`);
        });
    }

    function graficaFiltro1() {
        generarGraficas();
    }
    // Exponer la funciÃ³n graficaFiltro globalmente
    window.graficaFiltro = graficaFiltro1;

    // Graficos claros
    function crearGraficoDePastelClaro(elementId, labels, data, titulo, textColor = 'black') {
        const total = data.reduce((sum, value) => sum + value, 0);
    
        // Ordenar los datos de mayor a menor
        const sortedData = data.map((value, index) => ({ label: labels[index], value }))
            .sort((a, b) => b.value - a.value);
    
        const sortedLabels = sortedData.map(item => item.label);
        const sortedValues = sortedData.map(item => item.value);
        const sortedPercentages = sortedValues.map(value => ((value / total) * 100).toFixed(2));
    
        // Crear etiquetas personalizadas para la leyenda
        const legendLabels = sortedLabels.map((label, index) =>
            `${label}:  (${sortedPercentages[index]}%)`
        );
    
        // Definir separaciÃ³n para las secciones pequeÃ±as
        const pullValues = sortedPercentages.map(percent => (percent < 5 ? 0.2 : 0)); // Separar si es menor al 5%
    
        const trace = {
            labels: legendLabels,
            values: sortedValues,
            type: 'pie',
            hole: 0.4, // Convierte el grÃ¡fico en un donut
            hoverinfo: 'label',
            textinfo: 'none',
            marker: {
                line: {
                    color: '#FFFFFF',  // Borde blanco para mayor visibilidad
                    width: 1
                },
                colors: Plotly.d3.scale.category20().range()
            },
            pull: pullValues, // Separar secciones pequeÃ±as
            hoverlabel: {
                bgcolor: 'white',
                font: { color: 'black' }
            },
            insidetextfont: {
                color: textColor
            }
        };
    
        const layout = {
            title: {
                text: titulo,
                font: {
                    color: textColor
                }
            },
            height: 400,
            margin: { l: 0, r: 300, b: 0, t: 50 }, // Aumentar el margen derecho para leyenda
            paper_bgcolor: 'rgba(0, 0, 0, 0)', // Fondo transparente
            plot_bgcolor: 'rgba(0, 0, 0, 0)', // Fondo transparente
            showlegend: true,
            legend: {
                x: 1.1,  // Ajusta la posiciÃ³n de la leyenda a la derecha
                y: 1,
                traceorder: 'normal',
                font: {
                    size: 12,
                    color: textColor
                },
                itemsizing: 'constant',
                // Habilitar desplazamiento si la leyenda es muy larga
                yanchor: 'top',
                valign: 'middle',
            },
            legend_scroll: {
                height: 300, // Limitar la altura de la leyenda
            }
        };
    
        const config = {
            displayModeBar: false, // Ocultar la barra de herramientas
            locale: 'es', // Intentar definir el idioma a espaÃ±ol (opcional)
            displaylogo: false, // Ocultar el logo de Plotly
            modeBarButtonsToRemove: ['toImage'], // Elimina botones innecesarios
            showTips: false // Eliminar el cuadro de ayuda
        };
        Plotly.newPlot(elementId, [trace], layout, config);
    }
    
    function crearGraficoBarClaro(elementId, labels, data, titulo, textColor1 = 'black') {
        const total = data.reduce((sum, value) => sum + value, 0);
    
        // Ordenar los datos de mayor a menor
        const sortedData = data.map((value, index) => ({ label: labels[index], value }))
            .sort((a, b) => b.value - a.value);
    
        const sortedLabels = sortedData.map(item => `${item.label}  `);
        const sortedValues = sortedData.map(item => item.value);
    
        const reversedLabels = sortedLabels.reverse();
        const reversedValues = sortedValues.reverse();
    
        const trace = {
            x: reversedValues,
            y: reversedLabels,
            type: 'bar',
            orientation: 'h',
            text: sortedLabels.map((label, index) => 
                `${label}<br>(${(sortedValues[index] / total * 100).toFixed(2)}%)`
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: 'white',
                font: { color: 'black' }
            },
            marker: {
                color: '#3366cc'
            }
        };
    
        // Ajustar la altura del grÃ¡fico en funciÃ³n de la cantidad de datos
        const height = reversedLabels.length * 60 + 150;
    
        const layout = {
            title: {
                text: titulo,
                font: {
                    color: textColor1
                }
            },
            xaxis: {
                showticklabels: false, 
                color: textColor1,
                gridcolor: textColor1,
                linecolor: textColor1,
                zerolinecolor: textColor1
            },
            yaxis: {
                automargin: true,
                tickfont: {
                    size: 14
                },
                color: textColor1,
                gridcolor: textColor1,
                linecolor: textColor1,
                zerolinecolor: textColor1
            },
            margin: {
                l: 250,  // Aumentar el margen izquierdo para etiquetas mÃ¡s largas
                r: 250,
                t: 50,
                b: 50
            },
            width: 1360,  // Ancho del grÃ¡fico
            height: height,  // Ajustar la altura en funciÃ³n del nÃºmero de barras
            plot_bgcolor: 'rgba(0, 0, 0, 0)', // Fondo transparente
            paper_bgcolor: 'rgba(0, 0, 0, 0)'  // Fondo transparente
        };
    
        const config = {
            displayModeBar: false  // Ocultar la barra de herramientas
        };
        Plotly.newPlot(elementId, [trace], layout, config);
    }
    
    // Graficos Oscuros
    function crearGraficoDePastelOscuro(elementId, labels, data, titulo) {
        const total = data.reduce((sum, value) => sum + value, 0);
    
        // Ordenar los datos de mayor a menor
        const sortedData = data.map((value, index) => ({ label: labels[index], value }))
            .sort((a, b) => b.value - a.value);
    
        const sortedLabels = sortedData.map(item => item.label);
        const sortedValues = sortedData.map(item => item.value);
        const sortedPercentages = sortedValues.map(value => ((value / total) * 100).toFixed(2));
    
        // Crear etiquetas personalizadas para la leyenda
        const legendLabels = sortedLabels.map((label, index) =>
            `${label}: (${sortedPercentages[index]}%)`
        );
    
        const pullValues = sortedPercentages.map(percent => (percent < 5 ? 0.2 : 0));
    
        const trace = {
            labels: legendLabels,
            values: sortedValues,
            type: 'pie',
            hole: 0.4,
            hoverinfo: 'label',
            textinfo: 'none',
            marker: {
                line: {
                    color: '#2B2B2B',  // Color de borde
                    width: 1
                },
                colors: Plotly.d3.scale.category20().range()
            },
            pull: pullValues,
            hoverlabel: {
                bgcolor: 'white',
                font: { color: 'black' } // Etiquetas de hover (negro sobre blanco)
            },
            insidetextfont: {
                color: 'white' // Texto interno en blanco
            }
        };
    
        const layout = {
            title: {
                text: titulo,
                font: {
                    color: 'white' // TÃ­tulo en blanco
                }
            },
            height: 400,
            margin: { l: 0, r: 300, b: 0, t: 50 },
            paper_bgcolor: 'rgba(0, 0, 0, 0)', 
            plot_bgcolor: 'rgba(0, 0, 0, 0)',
            showlegend: true,
            legend: {
                x: 1.1,
                y: 1,
                traceorder: 'normal',
                font: {
                    size: 12,
                    color: 'white' // Texto de leyenda en blanco
                },
                itemsizing: 'constant',
                yanchor: 'top',
                valign: 'middle',
            }
        };
    
        const config = {
            displayModeBar: false,
            locale: 'es',
            displaylogo: false,
            modeBarButtonsToRemove: ['toImage'],
            showTips: false
        };
    
        Plotly.newPlot(elementId, [trace], layout, config);
    }
    
    function crearGraficoBarOscuro(elementId, labels, data, titulo, textColor1 = 'white') {
        const total = data.reduce((sum, value) => sum + value, 0);
    
        // Ordenar los datos de mayor a menor
        const sortedData = data.map((value, index) => ({ label: labels[index], value }))
            .sort((a, b) => b.value - a.value);
    
        const sortedLabels = sortedData.map(item => `${item.label}  `);
        const sortedValues = sortedData.map(item => item.value);
    
        const reversedLabels = sortedLabels.reverse();
        const reversedValues = sortedValues.reverse();
    
        const trace = {
            x: reversedValues,
            y: reversedLabels,
            type: 'bar',
            orientation: 'h',
            text: sortedLabels.map((label, index) => 
                `${label}<br>(${(sortedValues[index] / total * 100).toFixed(2)}%)`
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: 'white',
                font: { color: 'black' }
            },
            marker: {
                color: '#3366cc'
            }
        };
    
        // Ajustar la altura del grÃ¡fico en funciÃ³n de la cantidad de datos
        const height = reversedLabels.length * 60 + 150;
    
        const layout = {
            title: {
                text: titulo,
                font: {
                    color: textColor1
                }
            },
            xaxis: {
                showticklabels: false, 
                color: textColor1,
                gridcolor: textColor1,
                linecolor: textColor1,
                zerolinecolor: textColor1
            },
            yaxis: {
                automargin: true,
                tickfont: {
                    size: 14
                },
                color: textColor1,
                gridcolor: textColor1,
                linecolor: textColor1,
                zerolinecolor: textColor1
            },
            margin: {
                l: 250,  // Aumentar el margen izquierdo para etiquetas mÃ¡s largas
                r: 250,
                t: 50,
                b: 50
            },
            width: 1360,  // Ancho del grÃ¡fico
            height: height,  // Ajustar la altura en funciÃ³n del nÃºmero de barras
            plot_bgcolor: 'rgba(0, 0, 0, 0)', // Fondo transparente
            paper_bgcolor: 'rgba(0, 0, 0, 0)'  // Fondo transparente
        };
    
        const config = {
            displayModeBar: false  // Ocultar la barra de herramientas
        };
    
        Plotly.newPlot(elementId, [trace], layout, config);
    }

    // FunciÃ³n para volver a mostrar las graficas
    document.getElementById('graficas').addEventListener('click', function() {
        document.getElementById('graficas').style.display = 'none';
        document.getElementById('tabla').style.display = 'block';

        document.getElementById('viewDataTable').style.display = 'none';
        document.getElementById('graficoContainer').style.display = 'block';
    });

    // FunciÃ³n para volver a mostrar la tabla
    document.getElementById('tabla').addEventListener('click', function() {
        document.getElementById('graficas').style.display = 'block';
        document.getElementById('tabla').style.display = 'none';

        document.getElementById('viewDataTable').style.display = 'block';
        document.getElementById('graficoContainer').style.display = 'none';
    });

    // BotÃ³n para exportar toda la informaciÃ³n generada
    document.getElementById('exportar').addEventListener('click', function () {
        const inicio = document.getElementById('FechaInicio').value;
        const fin = document.getElementById('FechaFinal').value;
    
        // Redirigir al endpoint que genera y descarga el CSV
        const url = `${basePath}backend/exportarTodo?inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`;
        window.location.href = url;
    });
    
    // BotÃ³n para exportar toda la informaciÃ³n generada
    document.getElementById('export').addEventListener('click', function () {
        const inicio = document.getElementById('FechaInicio').value;
        const fin = document.getElementById('FechaFinal').value;
    
        // Redirigir al endpoint que genera y descarga el CSV
        const url = `${basePath}backend/exportarTodo?inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`;
        window.location.href = url;
    });

    // BotÃ³n para exportar informaciÃ³n filtrada
    document.getElementById('exportFilter').addEventListener('click', function () {
        const sucursal = document.getElementById('sucursalFiltro').value || null;
        const departamento = document.getElementById('departamentoFiltro').value || null;
        const categoria = document.getElementById('categoriaFiltro').value || null;
        const subcategoria = document.getElementById('subcategoriaFiltro').value || null;
        const searchTerm = document.getElementById('descProduc').value.trim() || null;
        const fechaInicio = document.getElementById('FechaInicio').value || null;
        const fechaFin = document.getElementById('FechaFinal').value || null;
    
        // Crear un formulario oculto para enviar los filtros al servidor
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${basePath}backend/exportarFiltrado`;
    
        const fields = { sucursal, departamento, categoria, subcategoria, searchTerm, fechaInicio, fechaFin };
        for (const [key, value] of Object.entries(fields)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        }
    
        document.body.appendChild(form);
        form.submit(); // Enviar el formulario
        document.body.removeChild(form);
    });
    
    // Boton para limpiar toda la informacion generada
    document.getElementById('limpiar').addEventListener('click', function (e) {
        document.getElementById('Busqueda').style.display = 'block';
        document.getElementById('viewDataTable').style.display = 'block';
        document.getElementById('graficas').style.display = 'block';
    
        document.getElementById('Filtros').style.display = 'none';
        document.getElementById('graficoContainer').style.display = 'none';
        document.getElementById('tabla').style.display = 'none';
    
        // Restablecer los selectores a la opciÃ³n predeterminada
        document.getElementById('sucursalBusqueda').selectedIndex = 0;
        document.getElementById('sucursalFiltro').selectedIndex = 0;
        document.getElementById('departamentoFiltro').selectedIndex = 0;
        document.getElementById('categoriaFiltro').selectedIndex = 0;
        document.getElementById('subcategoriaFiltro').selectedIndex = 0;
        document.getElementById('descProduc').value = '';
        document.getElementById('descProduc').innerText = '';
    
        const tbody = document.querySelector('table tbody');
        tbody.innerHTML = ''; // Limpiar la tabla
    
        // Destruir cualquier instancia previa de DataTables para evitar conflictos
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            $('#dataTable').DataTable().clear().destroy();
        }
    
        // Llamar al backend para limpiar los datos almacenados
        fetch(`${basePath}backend/limpiarReporteVentas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al limpiar los datos en el backend.');
            }
            return response.json();
        })
        .then(result => {
            console.log(result.message); // Mostrar mensaje del servidor
        })
        .catch(error => {
            console.error('Error al limpiar los datos:', error);
        });
    });
});

