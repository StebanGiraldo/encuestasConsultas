const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

// Vista: Registro
router.get('/registro', (req, res) => {
  res.render('registro');
});

// Lógica: Registro
router.post('/registro', async (req, res) => {
  console.log(req.body);  // Para depuración
  const {
    nombre,
    email,
    contrasena,
    verificarContrasena,
    identificacion,
    edad,
    sexo,
    departamento,
    ocupacion,
    tipoOrganizacion,
    direccion,
    telefono,
    rol  // Recibido desde el input hidden
  } = req.body;
  
  if (contrasena !== verificarContrasena) {
    return res.send('Las contraseñas no coinciden');
  }
  
  const existente = await Usuario.findOne({ $or: [{ email }, { identificacion }] });
  if (existente) return res.send('El correo o la identificación ya está registrada');
  
  try {
    const hash = await bcrypt.hash(contrasena, 10);
    
    const usuarioData = {
      nombre,
      email,
      contrasena: hash,
      identificacion,
      rol
    };
    
    if (rol === 'entidad') {
      // Asigna solo los datos de organización
      usuarioData.tipoOrganizacion = tipoOrganizacion;
      usuarioData.direccion = direccion;
      usuarioData.telefono = telefono;
    } else {
      // Asigna los datos de ciudadano
      usuarioData.edad = edad;
      usuarioData.sexo = sexo;
      usuarioData.departamento = departamento;
      usuarioData.ocupacion = ocupacion;
    }
    
    const usuario = new Usuario(usuarioData);
    await usuario.save();
    res.redirect('/login');
    
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registrando usuario');
  }
});

// Vista: Login
router.get('/login', (req, res) => {
  res.render('login');
});

// Lógica: Login
router.post('/login', async (req, res) => {
  const { email, contrasena } = req.body;
  const usuario = await Usuario.findOne({ email });
  if (usuario && await bcrypt.compare(contrasena, usuario.contrasena)) {
    req.session.usuario = {
      id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      identificacion: usuario.identificacion,
      rol: usuario.rol
    };
    if (usuario.rol === 'usuario') {
      req.session.usuario.edad = usuario.edad;
      req.session.usuario.sexo = usuario.sexo;
      req.session.usuario.departamento = usuario.departamento;
      req.session.usuario.ocupacion = usuario.ocupacion;
    } else {
      req.session.usuario.tipoOrganizacion = usuario.tipoOrganizacion;
      req.session.usuario.direccion = usuario.direccion;
      req.session.usuario.telefono = usuario.telefono;
    }
    res.redirect('/');
  } else {
    res.send('Correo o contraseña incorrectos');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
