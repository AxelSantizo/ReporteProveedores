document.addEventListener('DOMContentLoaded', () => {
    // Variable global para el prefijo de ruta
    const basePath = '/RProveedor/';

    // Deshabilitar combinaciones de teclas específicas
    document.addEventListener('keydown', function(e) {
        // Deshabilitar Ctrl+U (ver código fuente)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            console.log('Ctrl+U deshabilitado');
        }

        // Deshabilitar F12 (herramientas de desarrollador)
        if (e.key === 'F12') {
            e.preventDefault();
            console.log('F12 deshabilitado');
        }

        // Deshabilitar Ctrl+Shift+I (herramientas de desarrollador)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            console.log('Ctrl+Shift+I deshabilitado');
        }

        // Deshabilitar Ctrl+Shift+J (consola)
        if (e.ctrlKey && e.shiftKey && e.key === 'J') {
            e.preventDefault();
            console.log('Ctrl+Shift+J deshabilitado');
        }

        // Deshabilitar Ctrl+Shift+C (inspeccionar elemento)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            console.log('Ctrl+Shift+C deshabilitado');
        }
    });

    verificarSesion();
    setInterval(verificarSesion, 300000);

    // Verificar la autenticación del usuario en el cliente
    fetch(`${basePath}auth/verify`)
    .then(response => response.json())
    .then(data => {
        if (!data.authenticated) {
            window.location.href = basePath;
        } else {
            // Obtener el nombre completo del usuario
            fetch(`${basePath}auth/nombre`)
            .then(response => response.json())
            .then(nombreData => {
                if (nombreData.nombreCompleto) {
                    document.getElementById('nombrenavbar').textContent = nombreData.nombreCompleto;
                }
            })
            .catch(error => {
                console.error('Error al obtener el nombre completo:', error);
            });
        }
    })
    .catch(error => {
        console.error('Error al verificar la autenticación:', error);
        window.location.href = basePath;
    });

    // Carga el contenido del navbar
    fetch('views/navbar.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar-placeholder').innerHTML = data;

            function logout(){
                fetch(`${basePath}logout`, {
                    method: 'GET',
                    headers: { 'Cache-Control': 'no-cache' }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        localStorage.setItem('logout', 'true');
                        // Borra el historial del navegador
                        window.history.pushState(null, null, '/');
                        window.history.pushState(null, null, '/');
                        window.history.back();
                        window.location.replace(`${basePath}`);
                    } else {
                        console.error('Error al cerrar sesión:', data.message);
                    }
                })
                .catch(error => {
                    console.error('Error al cerrar sesión:', error);
                });s
            }

            function limpiarCache(){
                // Llamar al backend para limpiar los datos almacenados
                fetch(`${basePath}backendCategorias/limpiarReporteCategoria`, {
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

                // Llamar al backend para limpiar los datos almacenados
                fetch(`${basePath}backendInventario/limpiarReporteInventario`, {
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
            }
            

            // Obtener las páginas que el usuario puede ver
fetch(`${basePath}auth/getPaginas`)
.then(res => res.json())
.then(data => {
    const paginas = data.paginas || [];

    // Mapeo de IDs de páginas y botones
    const botonesPorPagina = {
        '1': 'ventas',
        '2': 'inventario',
        '3': 'categorias'
        // Agrega aquí más si tienes más páginas
    };

    // Ocultar todos primero por seguridad
    for (const id of Object.values(botonesPorPagina)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.display = 'none';
        }
    }

    // Mostrar solo los que sí están autorizados
    for (const pagina of paginas) {
        const botonId = botonesPorPagina[pagina];
        if (botonId) {
            const btn = document.getElementById(botonId);
            if (btn) {
                btn.style.display = 'block';
            }
        }
    }
})
.catch(error => {
    console.error('Error al obtener permisos de página:', error);
});


            // Configurar el evento de logout
            document.getElementById('logout').addEventListener('click', function (e) {
                e.preventDefault();
                logout();
                window.location.replace(`${basePath}`)
                limpiarCache();
            });

            document.getElementById('ventas').addEventListener('click', function (e) {
                window.location.replace(`${basePath}ventas`); 
                limpiarCache();
            });

            document.getElementById('inventario').addEventListener('click', function (e) {
                window.location.replace(`${basePath}inventario`); 
                limpiarCache();
            });

            document.getElementById('categorias').addEventListener('click', function (e) {
                window.location.replace(`${basePath}categorias`); 
                limpiarCache();
            });

            document.getElementById('menu').addEventListener('click', function (e) {
                window.location.replace(`${basePath}menu`); 
                limpiarCache();
            });

            // Cargar el tema desde localStorage
            let currentTheme = localStorage.getItem('theme') || 'css/claro.css';
            document.getElementById('themeStylesheet').setAttribute('href', currentTheme);

            // Establecer la clase de la tabla según el tema cargado
            let dataTable = document.getElementById('dataTable');
            if (dataTable) {
                if (currentTheme === 'css/claro.css') {
                    dataTable.className = 'table table-striped table-light table mb-0';
                } else {
                    dataTable.className = 'table table-striped table-dark table mb-0';
                }
            }

            document.getElementById('buttonTheme').addEventListener('click', function () {
                let themeStylesheet = document.getElementById('themeStylesheet');
                let currentTheme = themeStylesheet.getAttribute('href');
                let newTheme = currentTheme === 'css/claro.css' ? 'css/oscuro.css' : 'css/claro.css';
            
                // Cambiar el tema
                themeStylesheet.setAttribute('href', newTheme);
            
                // Guardar la preferencia en localStorage
                localStorage.setItem('theme', newTheme);
            
                // Cambiar la clase de la tabla según el tema
                if (dataTable) {
                    if (newTheme === 'css/claro.css') {
                        dataTable.className = 'table table-striped table-light table mb-0';
                    } else {
                        dataTable.className = 'table table-striped table-dark table mb-0';
                    }
                }
                 // Actualizar las gráficas si existen
                if (window.graficaFiltro) {
                    window.graficaFiltro();
                }
            });

            function estadoOpen() {
                fetch(`${basePath}auth/getOpenStatus`)
                .then(response => response.json())
                .then(data => {
                    if (data.open !== undefined) {
                        const estado = data.open;
            
                        if (estado == 1) {
                        } else {
                            logout();
                        }
            
                    } else {
                        console.error('Error al obtener el estado open:', data.error);
                    }
                })
                .catch(error => console.error('Error en la solicitud:', error));
            }
            estadoOpen();
            setInterval(estadoOpen, 1000); 


            function estadoTipo() {
                fetch(`${basePath}auth/getTipo`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.Tipo !== undefined) {
                            const tipo = data.Tipo;
            
                            if (tipo != 1) {
                                Swal.fire({
                                    title: 'Cambio de contraseña',
                                    html: `
                                        <label>Por favor ingrese su nueva contraseña</label>
                                        <br><br>
            
                                        <div class="col-md-8 mx-auto">
                                            <div class="input-group col-md-1">
                                                <input type="password" id="nuevaPassword" class="form-control col-md-2" placeholder="Ingrese la nueva contraseña">
                                                <button class="btn btn-outline-primary" type="button" id="togglePassword"><i class="fa fa-eye"></i></button>
                                            </div>
                                        </div>
            
                                        <br>
                                        <div class="col-md-8 mx-auto">
                                            <div class="input-group col-md-1">
                                                <input type="password" id="nuevaPasswordVerify" class="form-control col-md-2" placeholder="Verifique la nueva contraseña">
                                                <button class="btn btn-outline-primary" type="button" id="togglePasswordVerify"><i class="fa fa-eye"></i></button>
                                            </div>
                                        </div>
                                    `,
                                    icon: 'warning',
                                    showCancelButton: false,
                                    allowOutsideClick: false,
                                    allowEscapeKey: false,
                                    confirmButtonText: 'Cambiar',
                                    preConfirm: async () => {
                                        const password = document.getElementById('nuevaPassword').value;
                                        const passwordVerify = document.getElementById('nuevaPasswordVerify').value;
            
                                        // Validaciones de los campos
                                        if (!password || !passwordVerify) {
                                            Swal.showValidationMessage('Debe llenar todos los campos');
                                            return false;
                                        }
            
                                        if (password.length < 8 || passwordVerify.length < 8) {
                                            Swal.showValidationMessage('La contraseña debe tener 8 o más caracteres.');
                                            return false;
                                        }
            
                                        if (password !== passwordVerify) {
                                            Swal.showValidationMessage('Las contraseñas deben de coincidir');
                                            return false;
                                        }
            
                                        // Verificar si la nueva contraseña es igual a la anterior
                                        try {
                                            const response = await fetch(`${basePath}auth/verificarPass`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({ password: password })
                                            });
                                            const data = await response.json();
            
                                            if (data.isSamePassword) {
                                                Swal.showValidationMessage('La nueva contraseña no puede ser igual a la anterior');
                                                return false;
                                            }
            
                                            return password; // Continuar si todo está bien
                                        } catch (error) {
                                            console.error('Error en la solicitud de verificación de contraseña:', error);
                                            Swal.showValidationMessage('Ocurrió un error al verificar la contraseña.');
                                            return false;
                                        }
                                    }
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        const nuevaPassword = result.value;
            
                                        // Si la contraseña es diferente, realizar el cambio
                                        fetch(`${basePath}auth/cambiarPassword`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ password: nuevaPassword })
                                        })
                                        .then(response => response.json())
                                        .then(data => {
                                            if (data.success) {
                                                Swal.fire({
                                                    title: 'Contraseña actualizada',
                                                    text: 'La contraseña ha sido actualizada exitosamente.',
                                                    icon: 'success',
                                                    confirmButtonText: 'OK'
                                                });
                                            } else {
                                                Swal.fire({
                                                    title: 'Error',
                                                    text: 'No se pudo actualizar la contraseña.',
                                                    icon: 'error',
                                                    confirmButtonText: 'OK'
                                                });
                                            }
                                        })
                                        .catch(error => {
                                            console.error('Error en la solicitud de cambio de contraseña:', error);
                                            Swal.fire({
                                                title: 'Error',
                                                text: 'Ocurrió un error al actualizar la contraseña.',
                                                icon: 'error',
                                                confirmButtonText: 'OK'
                                            });
                                        });
                                    }
                                });
            
                                // Prevenir espacios en los campos de contraseña
                                document.getElementById('nuevaPassword').addEventListener('input', function(event) {
                                    this.value = this.value.replace(/\s/g, ''); // Elimina los espacios
                                });
            
                                document.getElementById('nuevaPasswordVerify').addEventListener('input', function(event) {
                                    this.value = this.value.replace(/\s/g, ''); // Elimina los espacios
                                });
            
                                // Función para alternar la visibilidad de un campo de contraseña
                                function togglePasswordVisibility(inputId, buttonId) {
                                    const passwordInput = document.getElementById(inputId);
                                    const toggleButton = document.getElementById(buttonId);
                                    const icon = toggleButton.querySelector('i');
            
                                    const isPasswordVisible = passwordInput.type === 'text';
                                    passwordInput.type = isPasswordVisible ? 'password' : 'text';
            
                                    icon.classList.toggle('fa-eye-slash', !isPasswordVisible);
                                    icon.classList.toggle('fa-eye', isPasswordVisible);
                                }
            
                                // Asignar el evento a cada botón para alternar la visibilidad de las contraseñas
                                document.getElementById('togglePassword').addEventListener('click', function() {
                                    togglePasswordVisibility('nuevaPassword', 'togglePassword');
                                });
            
                                document.getElementById('togglePasswordVerify').addEventListener('click', function() {
                                    togglePasswordVisibility('nuevaPasswordVerify', 'togglePasswordVerify');
                                });
                            }
                        } else {
                            console.error('Error al obtener el tipo usuario:', data.error);
                        }
                    })
                    .catch(error => console.error('Error en la solicitud:', error));
            }
            estadoTipo();
        })
        .catch(error => {
            console.error('Error al cargar el navbar:', error);
    });

    // Verificación inicial de logout
    (function() {
        if (localStorage.getItem('logout') === 'true') {
            localStorage.removeItem('logout');
            window.location.replace(`${basePath}`);
            // Borra el historial del navegador
            window.history.pushState(null, null, '/');
            window.history.pushState(null, null, '/');
            window.history.back();
        }
    })();

    async function verificarSesion() {
        return fetch(`${basePath}auth/nombre`, { 
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('No autenticado');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error de autenticación:', error);
            window.location.replace(`${basePath}`);
        });
    }

    function forzarRecarga() {
        verificarSesion();
    }

    // Detectar navegación hacia atrás
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            forzarRecarga();
        }
    });
});



