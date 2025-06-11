# ReporteProveedor

## ¿Qué es?

**ReporteProveedor** es una aplicación web para la gestión, consulta y análisis de inventarios, ventas y categorías de productos en sucursales de una empresa. Permite a los usuarios autenticados generar reportes detallados y agrupados, aplicar filtros avanzados, visualizar datos en tablas y gráficas, y exportar la información a archivos CSV.

## Funcionalidades principales

- **Autenticación de usuarios**: Acceso seguro para proveedores y administradores.
- **Gestión de inventario**: Consulta de existencias por sucursal, departamento, categoría y subcategoría.
- **Gestión de ventas**: Reportes de ventas diarias globales, filtrados por fechas, sucursal, departamento, categoría y subcategoría.
- **Gestión de categorías**: Visualización y filtrado de productos por categorías y subcategorías.
- **Filtros avanzados**: Búsqueda por descripción, UPC, sucursal, departamento, categoría, subcategoría y proveedor.
- **Visualización de datos**: Tablas dinámicas con paginación y búsqueda, y generación de gráficas (barras y pastel) por sucursal, departamento, categoría, subcategoría y proveedor.
- **Exportación de reportes**: Descarga de reportes completos o filtrados en formato CSV.
- **Cambio de tema**: Soporte para temas claro y oscuro en la interfaz.
- **Restablecimiento de filtros y datos**: Limpieza de filtros y datos generados para nuevas consultas.

## Estructura del proyecto

```
ReporteProveedor/
│
├── backend/
│   ├── autenticacion.js      # Lógica de autenticación y sesiones
│   ├── categorias.js         # Endpoints para reportes y filtros de categorías
│   ├── connection.js         # Configuración de la conexión a la base de datos
│   ├── inventario.js         # Endpoints para reportes y filtros de inventario
│   ├── main.js               # Configuración principal del backend y rutas generales
│   └── ventas.js             # Endpoints para reportes y filtros de ventas
│
├── css/
│   ├── claro.css             # Estilos para el tema claro
│   └── oscuro.css            # Estilos para el tema oscuro
│
├── img/                      # Imágenes utilizadas en la interfaz
│
├── js/
│   ├── categorias.js         # Lógica frontend para reportes de categorías
│   ├── inventario.js         # Lógica frontend para reportes de inventario
│   ├── login.js              # Lógica de autenticación en frontend
│   ├── menu.js               # Lógica del menú principal
│   ├── navbar.js             # Lógica de la barra de navegación
│   └── ventas.js             # Lógica frontend para reportes de ventas
│
├── views/
│   ├── categorias.html       # Vista de reportes de categorías
│   ├── inventario.html       # Vista de reportes de inventario
│   ├── login.html            # Vista de inicio de sesión
│   ├── menu.html             # Vista del menú principal
│   ├── navbar.html           # Fragmento de barra de navegación
│   └── ventas.html           # Vista de reportes de ventas
│
└── package.json              # Dependencias y scripts del proyecto
```

## Tecnologías utilizadas

- **Node.js + Express** para el backend (API REST).
- **MySQL** como base de datos.
- **HTML, CSS, JavaScript** para el frontend.
- **Bootstrap** para la interfaz de usuario.
- **DataTables** para tablas dinámicas.
- **Google Charts y/o Plotly** para gráficas.
- **json2csv** para exportación de datos.

## Flujo general de uso

1. El usuario inicia sesión.
2. Selecciona el módulo (Inventario, Ventas, Categorías).
3. Aplica filtros y genera reportes.
4. Visualiza los datos en tablas y gráficas.
5. Exporta la información si lo desea.
