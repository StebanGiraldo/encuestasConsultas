// app.js
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const http = require('http');
const socketIo = require('socket.io');
require("dotenv").config();

const Usuario = require('./models/Usuario');

const app = express();

// 📡 Conexión a MongoDB

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado a MongoDB"))
  .catch(err => console.error("Error de conexión", err));

// Configuración del servidor
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🧱 Middlewares globales
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Sesiones
app.use(session({
  secret: 'secreto_super_seguro',
  resave: false,
  saveUninitialized: false
}));

// Flash messages
app.use(flash());

// Variables globales para todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.mensajeExito = req.flash('exito');
  res.locals.mensajeError = req.flash('error');
  next();
});

// =======================
// 🌐 Rutas principales
// =======================
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/perfil', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');
  res.render('perfil');
});

const encuestasRoutes = require('./routes/encuestas');
app.use('/encuestas', encuestasRoutes);

// ======================
// 📝 Rutas Modulares
// ======================
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

app.use('/', authRoutes);
app.use('/admin', adminRoutes);

// =======================
// 🚀 Arrancar el servidor con Socket.io
// =======================
// Creamos el servidor HTTP a partir de Express
const server = http.createServer(app);

// Configuramos Socket.io
const io = socketIo(server);

// Configuración básica de Socket.io
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  // Escucha para que el cliente se una a la sala de una encuesta
  socket.on('unirSalaEncuesta', (encuestaId) => {
    socket.join(encuestaId);
    console.log(`Cliente unido a sala de encuesta ${encuestaId}`);
  });

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

// Exportamos la instancia de io en app, para usarla en rutas
app.set('io', io);

// Inicia el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
