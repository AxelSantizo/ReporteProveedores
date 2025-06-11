document.addEventListener('DOMContentLoaded', function () {
    // Variable global para el prefijo de ruta
    const basePath = '/RProveedor/';

    // Deshabilitar el menú contextual
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

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
    
    // Cargar el tema desde localStorage
    let currentTheme = localStorage.getItem('theme') || 'css/claro.css';
    document.getElementById('themeStylesheet').setAttribute('href', currentTheme);

    // Añadir el evento de clic al botón del tema
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
    });

    // Verificar si el usuario ha cerrado sesión
    if (localStorage.getItem('logout') === 'true') {
        localStorage.removeItem('logout');
        // Borra el historial del navegador
        history.pushState(null, null, location.href);
        window.addEventListener('popstate', function () {
            history.pushState(null, null, location.href);
        });
    }

    // Función para mostrar cuadros de diálogo con SweetAlert2
    function showAlert(title, text, icon = 'info') {
        Swal.fire({
            title: title,
            html: text,
            icon: icon,
            confirmButtonText: 'OK'
        });
    }

    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
    
        const usuarioInput = document.getElementById('usuario');
        const contrasenaInput = document.getElementById('contrasena');
    
        const usuario = usuarioInput.value.toLowerCase();
        const pass = contrasenaInput.value.toLowerCase();
    
        if (!usuario || !pass) {
            showAlert('Error', 'Por favor, llena todos los campos', 'error');
            return;
        }
    
        fetch(`${basePath}auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, pass })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error && data.error === 'El usuario ya tiene una sesión activa') {
                Swal.fire({
                    title: 'Sesion activa',
                    text: 'El usuario ya tiene una sesion activa. ¿Deseas cerrar la sesion activa y continuar?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Si, cerrar sesion',
                    cancelButtonText: 'No'
                }).then((result) => {
                    if (result.isConfirmed) {
                        fetch(`${basePath}auth/cerrarSesion`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ idUsuarioP: data.idUsuarioP })
                        })
                        .then(response => response.json())
                        .then(cerrarData => {
                            if (cerrarData.error) {
                                showAlert('Error', cerrarData.error, 'error');
                            } else {
                                showAlert('Éxito', 'Sesión cerrada. Vuelve a intentar iniciar sesión.', 'success');
                            }
                        })
                        .catch(error => {
                            console.error('Error al cerrar la sesión activa:', error);
                            showAlert('Error', 'Hubo un problema cerrando la sesión activa', 'error');
                        });
                    }
                });
    
            } else if (data.error) {
                showAlert('Error', data.error, 'error');
    
            } else {
                if (data.requiereTOTP) {
                    // Si no está configurado aún, mostrar QR
                    fetch(`${basePath}auth/activar-totp`)
                        .then(res => res.json())
                        .then(qrData => {
                            Swal.fire({
                                title: 'Configura Authenticator',
                                html: `
                                    <p>Escanea este código QR con tu app de autenticación (Google Authenticator o similar):</p>
                                    <img src="${qrData.qr}" alt="QR Code" style="margin: 10px 0;">
                                    <p>Luego ingresa el código de 6 dígitos para verificar.</p>
                                    <div id="totp-inputs" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
                                        ${'<input class="totp-digit" maxlength="1" style="width: 40px; height: 45; text-align: center; font-size: 20px;" />'.repeat(6)}
                                    </div>
                                `,
                                showCancelButton: true,
                                confirmButtonText: 'Verificar',
                                preConfirm: () => {
                                    const inputs = document.querySelectorAll('.totp-digit');
                                    const token = Array.from(inputs).map(input => input.value).join('');
                            
                                    if (token.length !== 6 || !/^[0-9]{6}$/.test(token)) {
                                        Swal.showValidationMessage('Por favor ingresa los 6 dígitos correctamente');
                                        return false;
                                    }
                            
                                    return fetch(`${basePath}auth/verificar-totp-setup`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ token })
                                    })
                                    .then(res => res.json())
                                    .then(setupData => {
                                        if (!setupData.success) {
                                            throw new Error(setupData.error || 'Código incorrecto');
                                        }
                                    })
                                    .catch(err => {
                                        Swal.showValidationMessage(err.message);
                                    });
                                },
                                didOpen: () => {
                                    const inputs = document.querySelectorAll('.totp-digit');
                                    inputs[0].focus();
                            
                                    const checkAutoSubmit = () => {
                                        const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
                                        if (allFilled) {
                                            Swal.clickConfirm(); // Auto-click cuando se completan los 6 dígitos
                                        }
                                    };
                            
                                    inputs.forEach((input, index) => {
                                        input.addEventListener('input', (e) => {
                                            const value = e.target.value;
                                            if (!/^[0-9]$/.test(value)) {
                                                e.target.value = '';
                                                return;
                                            }
                            
                                            if (index < inputs.length - 1) {
                                                inputs[index + 1].focus();
                                            }
                            
                                            checkAutoSubmit();
                                        });
                            
                                        input.addEventListener('keydown', (e) => {
                                            if (e.key === 'Backspace' && input.value === '' && index > 0) {
                                                inputs[index - 1].focus();
                                            }
                                        });
                                    });
                                }
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    Swal.fire('¡Éxito!', 'Aplicación configurada correctamente.', 'success');
                                }
                            });
                            
                        });
                } else {
                    Swal.fire({
                        title: 'Verificación',
                        html: `
                            <p>Ingresa el código de 6 dígitos generado por tu app de autenticación</p>
                            <div id="totp-inputs" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
                                ${Array(6).fill('').map((_, i) => `
                                    <input type="text" maxlength="1" pattern="[0-9]*" inputmode="numeric"
                                        class="totp-digit" id="digit-${i}" style="width: 40px; height: 50px; text-align: center; font-size: 24px;" />
                                `).join('')}
                            </div>
                        `,
                        showCancelButton: true,
                        didOpen: () => {
                            const inputs = document.querySelectorAll('.totp-digit');
                            inputs[0].focus();
                        
                            const checkAutoSubmit = () => {
                                const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
                                if (allFilled) {
                                    Swal.clickConfirm();
                                }
                            };
                        
                            inputs.forEach((input, index) => {
                                input.addEventListener('input', (e) => {
                                    const value = e.target.value;
                                    if (!/^[0-9]$/.test(value)) {
                                        e.target.value = ''; // solo números
                                        return;
                                    }
                        
                                    if (index < inputs.length - 1) {
                                        inputs[index + 1].focus();
                                    }
                        
                                    checkAutoSubmit();
                                });
                        
                                input.addEventListener('keydown', (e) => {
                                    if (e.key === 'Backspace' && input.value === '' && index > 0) {
                                        inputs[index - 1].focus();
                                    }
                                });
                            });
                        },                        
                        preConfirm: () => {
                            const digits = Array.from(document.querySelectorAll('.totp-digit')).map(i => i.value).join('');
                            if (digits.length !== 6) {
                                Swal.showValidationMessage('Debes ingresar los 6 dígitos');
                                return false;
                            }
                            return digits;
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            fetch(`${basePath}auth/verificar-totp-login`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token: result.value })
                            })
                            .then(response => response.json())
                            .then(totpData => {
                                if (totpData.success) {
                                    window.location.replace(`${basePath}menu`);
                                } else {
                                    showAlert('Error', totpData.error || 'Código incorrecto o expirado', 'error');
                                }
                            });
                        }
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error en la solicitud de login:', error);
            showAlert('Error', 'Hubo un problema con la solicitud', 'error');
        });
    });
    

    // Verificar si el usuario ha cerrado sesión
    if (localStorage.getItem('logout') === 'true') {
        localStorage.removeItem('logout');
        history.pushState(null, null, location.href);
        window.addEventListener('popstate', function () {
            history.pushState(null, null, location.href);
        });
    }

    document.getElementById('recuperarContrasena').addEventListener('click', function () {
        Swal.fire({
            title: 'Recuperacion de Contrasena',
            html: `
                <div class="col-md-10 mx-auto">
                    <div class="input-group mb-3">
                        <p>Ingrese el usuario y el codigo de acceso de Authenticator</p>
                    </div>
                </div>
                <div class="col-md-10 mx-auto">
                    <div class="input-group mb-3">
                        <input type="text" class="form-control" placeholder="Ingrese el usuario!" id="usuarioRecuperacion" style="text-align: center; font-size: 16px;">
                    </div>
                </div>
                <div class="col-md-10 mx-auto">
                    <div id="totp-inputs" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
                        ${'<input class="totp-digit" maxlength="1" style="width: 40px; height: 45px; text-align: center; font-size: 20px;" />'.repeat(6)}
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const usuario = document.getElementById('usuarioRecuperacion').value;
                const codigo = [...document.querySelectorAll('.totp-digit')].map(input => input.value).join('');
    
                if (!usuario || codigo.length !== 6) {
                    Swal.showValidationMessage('Completa todos los campos correctamente.');
                    return false;
                }
    
                return { usuario, token: codigo };
            },
            didOpen: () => {
                const inputs = [...document.querySelectorAll('.totp-digit')];
                inputs.forEach((input, i) => {
                    input.addEventListener('input', () => {
                        if (input.value.length === 1 && i < 5) inputs[i + 1].focus();
                    });
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
                    });
                });
                document.getElementById('usuarioRecuperacion').focus();
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { usuario, token } = result.value;
    
                fetch(`${basePath}auth/verificar-totp-recuperacion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, token })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        window.location.replace(`${basePath}menu`);
                    } else {
                        showAlert('Error', data.error || 'Código incorrecto o usuario inválido', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error en la recuperación:', error);
                    showAlert('Error', 'Ocurrió un problema en la verificación', 'error');
                });
            }
        });
    });
});