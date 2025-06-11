// Importación de express y router
const express = require('express'); 
const router = express.Router(); 
module.exports = router; 

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Importación de la conexión a la base de datos
const { connection } = require('./connection');

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const encryptionKey = crypto.createHash('sha256').update('my-secret-key-1234567890').digest();

// Función para desencriptar datos
function decrypt(encryptedText, key) {
  const [iv, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(Buffer.from(encrypted, 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }
  

// Ruta para activar TOTP
router.get('/activar-totp', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const secret = speakeasy.generateSecret({
        name: 'RProveedor', // Nombre que aparece en la app de autenticación
        length: 20
    });

    // Guardar secret temporalmente en sesión para validación posterior
    req.session.tempTotpSecret = secret.base32;

    // Generar el código QR
    qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
        if (err) {
            console.error('Error generando QR:', err);
            return res.status(500).json({ error: 'Error generando el QR' });
        }

        res.json({
            qr: dataUrl,
            secret: secret.base32
        });
    });
});

router.post('/verificar-totp-setup', (req, res) => {
    const { token } = req.body;
    const tempSecret = req.session.tempTotpSecret;
    const idUsuario = req.session.IdUsuarioP;

    if (!tempSecret || !idUsuario) {
        return res.status(400).json({ error: 'Sesión expirada o inválida' });
    }

    const verified = speakeasy.totp.verify({
        secret: tempSecret,
        encoding: 'base32',
        token: token
    });

    if (!verified) {
        return res.status(401).json({ error: 'Código incorrecto. Intenta nuevamente.' });
    }

    const encryptedSecret = encrypt(tempSecret, encryptionKey);

    const updateQuery = 'UPDATE usuarios_proveedor SET totp_secret = ? WHERE IdUsuarioP = ?';
    connection.query(updateQuery, [encryptedSecret, idUsuario], (err, result) => {
        if (err) {
            console.error('Error guardando el TOTP:', err);
            return res.status(500).json({ error: 'Error al guardar el TOTP' });
        }

        // Limpia la sesión temporal
        delete req.session.tempTotpSecret;

        res.json({ success: true, message: 'TOTP activado correctamente' });
    });
});

router.post('/verificar-totp-login', (req, res) => {
    const { token } = req.body;
    const user = req.session.user;

    if (!user) return res.status(401).json({ error: 'No autenticado' });

    try {
        const decryptedTotp = decrypt(user.totp_secret, encryptionKey);

        const verified = speakeasy.totp.verify({
            secret: decryptedTotp,
            encoding: 'base32',
            token: token,
            window: 1
        });

        if (!verified) {
            return res.status(401).json({ error: 'Código inválido' });
        }

        // Login exitoso
        const insertQuery = 'INSERT INTO login_proveedor (IdUsuarioP, FechaHoraLogin) VALUES (?, NOW())';
        connection.query(insertQuery, [user.IdUsuarioP], (insertErr) => {
            if (insertErr) {
                console.error('Error al registrar login:', insertErr);
                return res.status(500).json({ error: 'Error al registrar login' });
            }

            const updateQuery = 'UPDATE usuarios_proveedor SET open = 1 WHERE IdUsuarioP = ?';
            connection.query(updateQuery, [user.IdUsuarioP], (updateErr) => {
                if (updateErr) {
                    console.error('Error al actualizar estado:', updateErr);
                    return res.status(500).json({ error: 'Error al actualizar sesión' });
                }

                return res.json({ success: true, message: 'Inicio de sesión exitoso con TOTP' });
            });
        });

    } catch (error) {
        console.error('Error verificando TOTP:', error.message);
        return res.status(500).json({ error: 'Error procesando TOTP' });
    }
});


router.post('/login', async (req, res) => {
    const { usuario, pass } = req.body;

    if (!usuario || !pass) {
        return res.status(400).json({ error: 'Por favor, llena todos los campos' });
    }

    const userQuery = 'SELECT * FROM usuarios_proveedor';
    connection.query(userQuery, async (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        let foundUser = null;

        for (let user of results) {
            try {
                const decryptedUsuario = decrypt(user.usuario, encryptionKey);
                if (decryptedUsuario === usuario) {
                    foundUser = user;
                    break;
                }
            } catch (error) {
                console.error('Error desencriptando el usuario:', error.message);
            }
        }

        if (!foundUser) {
            return res.status(401).json({ error: 'Usuario incorrecto' });
        }

        const passwordMatch = await bcrypt.compare(pass, foundUser.pass);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        if (foundUser.estado === 0) {
            return res.status(401).json({ error: 'Usuario inactivo' });
        }

        if (foundUser.open == 1) {
            return res.status(401).json({ 
                error: 'El usuario ya tiene una sesión activa', 
                idUsuarioP: foundUser.IdUsuarioP
            });
        }

        // Preparar sesión
        const nombreCompleto = `${foundUser.primer_nombre} ${foundUser.segundo_nombre} ${foundUser.primer_apellido} ${foundUser.segundo_apellido}`;
        req.session.user = foundUser;
        req.session.nombreCompleto = nombreCompleto;
        req.session.IdProveedor = foundUser.IdProveedor;
        req.session.IdUsuarioP = foundUser.IdUsuarioP;
        req.session.paginas = foundUser.Pagina ? foundUser.Pagina.split(',') : [];

        const decryptedTotp = foundUser.totp_secret ? decrypt(foundUser.totp_secret, encryptionKey) : null;

        if (decryptedTotp) {
            // Ya tiene TOTP configurado
            return res.json({ requiereTOTP: false });
        } else {
            // Aún no lo tiene
            return res.json({ requiereTOTP: true });
        }
    });
});


// Método POST para verificar el código de verificación
router.post('/verificar-codigo', (req, res) => {
    const { codigoIngresado } = req.body;

    // Recupera el objeto user almacenado en la sesión
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (codigoIngresado === req.session.codigoVerificacion) {
        // Código correcto, permitir acceso
        const insertQuery = 'INSERT INTO login_proveedor (IdUsuarioP, FechaHoraLogin) VALUES (?, NOW())';
        connection.query(insertQuery, [user.IdUsuarioP], (insertErr) => {
            if (insertErr) {
                // Muestra el error si hay un problema con la inserción
                console.error('Error al insertar en login_proveedor:', insertErr); 
                return res.status(500).json({ error: 'Error en el servidor al registrar el login' });
            }

            // Actualizar el campo 'open' a 1 para indicar que la sesión está activa
            const updateQuery = 'UPDATE usuarios_proveedor SET open = 1 WHERE IdUsuarioP = ?';
            connection.query(updateQuery, [user.IdUsuarioP], (updateErr) => {
                if (updateErr) {
                    // Muestra el error si hay un problema al actualizar
                    console.error('Error al actualizar el campo open:', updateErr); 
                    return res.status(500).json({ error: 'Error en el servidor al actualizar el estado de la sesión' });
                }

                // Si ambas operaciones (inserción y actualización) son exitosas, responder con éxito
                res.json({ message: 'Código verificado correctamente, acceso permitido y sesión iniciada' });
            });
        });

    } else {
        // Código incorrecto
        res.status(401).json({ error: 'Código incorrecto' });
    }
});

// Ruta para obtener el logo del proveedor
router.get('/proveedor/logo', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const idProveedor = req.session.user.IdProveedor;
    const query = 'SELECT nombre, Logo FROM proveedores WHERE Id = ?';
    connection.query(query, [idProveedor], (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const logo = results[0].Logo;
        if (!logo) {
            return res.status(404).json({ error: 'Logo no encontrado' });
        }

        const base64Logo = Buffer.from(logo).toString('base64');
        res.json({ logo: `data:image/png;base64,${base64Logo}` });
    });
});

// Método POST para cerrar la sesión activa del usuario
router.post('/cerrarSesion', (req, res) => {
    const { idUsuarioP } = req.body;

    // Actualiza el campo 'open' a 0 para cerrar la sesión activa usando el IdUsuarioP
    const updateQuery = 'UPDATE usuarios_proveedor SET open = 0 WHERE IdUsuarioP = ?';
    connection.query(updateQuery, [idUsuarioP], (err) => {
        if (err) {
            console.error('Error cerrando la sesión activa:', err);
            res.status(500).json({ error: 'Error al cerrar la sesión activa' });
            return;
        }
        res.json({ message: 'Sesión cerrada exitosamente' });
    });
});

// Funcion open sirve obtener el estado open para cerrar sesion automaticamente
router.get('/getOpenStatus', (req, res) => {
    if (!req.session.IdUsuarioP) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const query = 'SELECT open FROM usuarios_proveedor WHERE IdUsuarioP = ?';
    connection.query(query, [req.session.IdUsuarioP], (err, result) => {
        if (err) {
            console.error('Error al consultar el estado de open:', err);
            return res.status(500).json({ error: 'Error en la consulta' });
        }

        if (result.length > 0) {
            res.json({ open: result[0].open });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    });
});

// Funcion tipo sirve para validar si es la primera vez que el usuario ingresa para que cambie su contraseña
router.get('/getTipo', (req, res) => {
    if (!req.session.IdUsuarioP) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const query = 'SELECT Tipo FROM usuarios_proveedor WHERE IdUsuarioP = ?';
    connection.query(query, [req.session.IdUsuarioP], (err, result) => {
        if (err) {
            console.error('Error al consultar el estado de Tipo:', err);
            return res.status(500).json({ error: 'Error en la consulta' });
        }

        if (result.length > 0) {
            res.json({ Tipo: result[0].Tipo });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    });
});

// Ruta para cambiar la contraseña
router.post('/cambiarPassword', async (req, res) => {
    const { password } = req.body;  // Obtener la contraseña del cuerpo de la solicitud
    const userId = req.session.IdUsuarioP;  

    if (!password || password.length < 6) {
        return res.json({ success: false, message: 'Contraseña inválida' });
    }
    try {
        // Encriptar la nueva contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Actualizar la contraseña en la base de datos
        const query = 'UPDATE usuarios_proveedor SET pass = ?, tipo = 1 WHERE IdUsuarioP = ?';  // Ajusta según tu tabla
        connection.query(query, [hashedPassword, userId], (err, result) => {
            if (err) {
                console.error('Error al actualizar la contraseña:', err);
                return res.json({ success: false, message: 'Error en el servidor' });
            }

            if (result.affectedRows > 0) {
                // Contraseña actualizada correctamente
                res.json({ success: true });
            } else {
                // El usuario no fue encontrado
                res.json({ success: false, message: 'No se pudo actualizar la contraseña' });
            }
        });
    } catch (error) {
        console.error('Error al encriptar la contraseña:', error);
        res.json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

router.post('/verificar-totp-recuperacion', (req, res) => {
    const { usuario, token } = req.body;

    if (!usuario || !token) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const query = 'SELECT * FROM usuarios_proveedor';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error consultando usuarios:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        let foundUser = null;

        for (let user of results) {
            try {
                const decryptedUsuario = decrypt(user.usuario, encryptionKey);
                if (decryptedUsuario === usuario) {
                    foundUser = user;
                    break;
                }
            } catch (error) {
                console.error('Error desencriptando usuario:', error.message);
            }
        }

        if (!foundUser || !foundUser.totp_secret) {
            return res.status(404).json({ error: 'Usuario no encontrado o sin autenticación 2FA' });
        }

        try {
            const decryptedTotp = decrypt(foundUser.totp_secret, encryptionKey);
            const verified = speakeasy.totp.verify({
                secret: decryptedTotp,
                encoding: 'base32',
                token,
                window: 1
            });

            if (!verified) {
                return res.status(401).json({ error: 'Código incorrecto o expirado' });
            }

            // Guardar datos en la sesión
            const nombreCompleto = `${foundUser.primer_nombre} ${foundUser.segundo_nombre} ${foundUser.primer_apellido} ${foundUser.segundo_apellido}`;
            req.session.user = foundUser;
            req.session.nombreCompleto = nombreCompleto;
            req.session.IdProveedor = foundUser.IdProveedor;
            req.session.IdUsuarioP = foundUser.IdUsuarioP;
            req.session.paginas = foundUser.Pagina.split(',');

            // Actualizar tipo y open
            const updateQuery = 'UPDATE usuarios_proveedor SET tipo = 0, open = 1 WHERE IdUsuarioP = ?';
            connection.query(updateQuery, [foundUser.IdUsuarioP], (updateErr) => {
                if (updateErr) {
                    console.error('Error actualizando estado del usuario:', updateErr);
                    return res.status(500).json({ error: 'Error al actualizar el estado del usuario' });
                }

                return res.json({ success: true, message: 'Verificación exitosa' });
            });

        } catch (error) {
            console.error('Error verificando TOTP:', error.message);
            return res.status(500).json({ error: 'Error interno al procesar el código' });
        }
    });
});

// Verificar si la nueva contraseña es igual a la anterior
router.post('/verificarPass', async (req, res) => {
    const { password } = req.body;

    // Verificar si el IdUsuarioP está disponible en la sesión
    const idUsuarioP = req.session.IdUsuarioP;
    if (!idUsuarioP) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Consulta para obtener la contraseña hasheada desde la base de datos
    const query = 'SELECT pass FROM usuarios_proveedor WHERE IdUsuarioP = ?';
    connection.query(query, [idUsuarioP], async (err, result) => {
        if (err) {
            console.error('Error ejecutando la consulta:', err);
            return res.status(500).json({ error: 'Error en la consulta' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const hashedPassword = result[0].pass;

        // Comparar la nueva contraseña con la contraseña hasheada almacenada
        try {
            const isSamePassword = await bcrypt.compare(password, hashedPassword);
            if (isSamePassword) {
                return res.json({ isSamePassword: true }); // Nueva contraseña es igual a la antigua
            } else {
                return res.json({ isSamePassword: false }); // Nueva contraseña es diferente
            }
        } catch (error) {
            console.error('Error comparando las contraseñas:', error);
            return res.status(500).json({ error: 'Error al comparar contraseñas' });
        }
    });
});

// Ruta para verificar la autenticación del usuario
router.get('/verify', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

router.get('/getPaginas', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    res.json({
        paginas: req.session.paginas || []  // Ya guardaste esto en login
    });
});
