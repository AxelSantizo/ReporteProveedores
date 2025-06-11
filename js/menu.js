document.addEventListener('DOMContentLoaded', function() { 
    // Variable global para el prefijo de ruta
    const basePath = '/RProveedor/';

    // 🔔 Mostrar alerta si fue redirigido por falta de permisos
    const urlParams = new URLSearchParams(window.location.search);
    const accesoDenegado = urlParams.get('denegado');

    if (accesoDenegado === 'true') {
        Swal.fire({
            title: 'Acceso denegado',
            text: 'No tienes permiso para acceder a esa página.',
            icon: 'warning',
            confirmButtonText: 'OK'
        });

        // Opcional: limpiar el parámetro de la URL sin recargar
        const newUrl = window.location.origin + basePath + 'menu';
        window.history.replaceState({}, document.title, newUrl);
    }

    // Actualizar la fecha y la hora al cargar la página
    updateDateTime();

    // Actualizar la hora cada segundo
    setInterval(updateDateTime, 1000);

    function updateDateTime() {
        const currentHour = new Date().getHours();
        document.getElementById('fechahora').textContent = new Date().toLocaleString();    

        if (currentHour < 12) {
            document.getElementById('bienvenida').textContent = 'Buenos días';
        } else if (currentHour < 18) {
            document.getElementById('bienvenida').textContent = 'Buenas tardes';
        } else {
            document.getElementById('bienvenida').textContent = 'Buenas noches';
        }
    }

    // Verificar la autenticación del usuario en el cliente
    fetch(`${basePath}auth/verify`)
    .then(response => response.json())
    .then(data => {
        if (!data.authenticated) {
            window.location.href = `${basePath}`;
        } else {
            // Obtener el nombre completo del usuario
            fetch(`${basePath}auth/nombre`)
            .then(response => response.json())
            .then(nombreData => {
                if (nombreData.nombreCompleto) {
                    document.getElementById('nombreCompleto').textContent = nombreData.nombreCompleto;
                }
            })
            .catch(error => {
                console.error('Error al obtener el nombre completo:', error);
            });

            // Obtener el logo del proveedor
            fetch(`${basePath}auth/proveedor/logo`)
            .then(response => response.json())
            .then(logoData => {
                if (logoData.logo) {
                    const imgElement = document.getElementById('logoProveedor');
                    imgElement.src = logoData.logo;
                    imgElement.alt = "Logo del Proveedor";
                } else {
                    console.error('No se recibió el logo.');
                }
            })
            .catch(error => {
                console.error('Error al obtener el logo del proveedor:', error);
            });
        }
    })
    .catch(error => {
        console.error('Error al verificar la autenticación:', error);
        window.location.href = `${basePath}`;
    });
});
