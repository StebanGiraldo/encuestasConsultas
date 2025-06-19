const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

// Middleware para verificar administrador
function isAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.rol !== 'administrador') {
    return res.redirect('/login');
  }
  next();
}

// Página principal de gestión
router.get('/usuarios', isAdmin, (req, res) => {
  res.render('admin/usuarios');
});

// Mostrar formulario para crear entidad
router.get('/usuarios/nueva', isAdmin, (req, res) => {
  res.render('admin/agregar_organizacion');
});

// Procesar creación de entidad
router.post('/usuarios', isAdmin, async (req, res) => {
  const {
    nombre,
    tipoOrganizacion,
    identificacion,
    direccion,
    telefono,
    email,
    contrasena,
    confirmarContrasena
  } = req.body;

  if (contrasena !== confirmarContrasena) {
    return res.send('Las contraseñas no coinciden');
  }

  try {
    const existente = await Usuario.findOne({ email });
    if (existente) return res.send('Ese correo ya está registrado');

    const hash = await bcrypt.hash(contrasena, 10);

    const nuevaOrganizacion = new Usuario({
      nombre,
      tipoOrganizacion,
      identificacion,
      direccion,
      telefono,
      email,
      contrasena: hash,
      rol: 'entidad'
    });

    await nuevaOrganizacion.save();
    res.redirect('/admin/usuarios');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al registrar organización');
  }
});

// Ver entidades registradas
router.get('/usuarios/entidades', isAdmin, async (req, res) => {
  const entidades = await Usuario.find({ rol: 'entidad' });
  res.render('admin/lista_usuarios', { titulo: 'Entidades Registradas', usuarios: entidades });
});

// Ver usuarios ciudadanos registrados
router.get('/usuarios/ciudadanos', isAdmin, async (req, res) => {
  const ciudadanos = await Usuario.find({ rol: 'usuario' });
  res.render('admin/lista_usuarios', { titulo: 'Usuarios Registrados', usuarios: ciudadanos });
});

module.exports = router;
