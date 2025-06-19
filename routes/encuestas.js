const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Encuesta = require('../models/encuesta');
const Respuesta = require('../models/Respuesta');
const Usuario = require('../models/Usuario');
const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit')

// 📜 Ruta para mostrar el formulario de creación de encuestas
router.get('/crear', (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== 'entidad') {
    req.flash('error', 'Solo entidades pueden crear encuestas.');
    return res.redirect('/encuestas');
  }
  res.render('encuestas/crear'); // Renderiza la vista del formulario
});

// 📝 Ruta para guardar la encuesta en MongoDB
router.post('/crear', async (req, res) => {
  try {
    const nuevaEncuesta = new Encuesta({
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      tipoEncuesta: req.body.tipoEncuesta,
      preguntas: req.body.preguntas ? req.body.preguntas.map(p => ({
        texto: p.texto,
        tipo: p.tipo,
        opciones: p.opciones || [],
        escala: p.tipo === 'escala' ? { min: p.escalaMin, max: p.escalaMax } : null
      })) : [],
      creadoPor: req.session.usuario.id,
      segmentacion: {
        edad: {
          min: req.body.edadMin ? parseInt(req.body.edadMin) : null,
          max: req.body.edadMax ? parseInt(req.body.edadMax) : null
        },
        departamento: req.body.departamento ? req.body.departamento.split(',').map(s => s.trim()) : [],
        ocupacion: req.body.ocupacion ? req.body.ocupacion.split(',').map(s => s.trim()) : []
      }
    });

    await nuevaEncuesta.save();
    req.flash('exito', 'Encuesta creada exitosamente.');
    res.redirect('/encuestas');
  } catch (error) {
    console.error('Error al crear la encuesta:', error);
    req.flash('error', 'Hubo un problema al crear la encuesta.');
    res.redirect('/encuestas/crear');
  }
});


// 📜 Ruta para listar encuestas
router.get('/', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      req.flash('error', 'Debes iniciar sesión para ver las encuestas.');
      return res.redirect('/login');
    }

    // Construir el filtro según la segmentación
    const filtros = { $and: [] };

    // Filtro de segmentación por edad
    if (usuario.edad) {
      filtros.$and.push({
        $or: [
          { "segmentacion.edad.min": { $lte: usuario.edad } },
          { "segmentacion.edad.min": null },
          { "segmentacion.edad.min": { $exists: false } }
        ]
      });
      filtros.$and.push({
        $or: [
          { "segmentacion.edad.max": { $gte: usuario.edad } },
          { "segmentacion.edad.max": null },
          { "segmentacion.edad.max": { $exists: false } }
        ]
      });
    }

    // Filtro por departamento
    if (usuario.departamento) {
      filtros.$and.push({
        $or: [
          { "segmentacion.departamento": { $size: 0 } },
          { "segmentacion.departamento": usuario.departamento },
          { "segmentacion.departamento": { $exists: false } }
        ]
      });
    }

    // Filtro por ocupación
    if (usuario.ocupacion) {
      filtros.$and.push({
        $or: [
          { "segmentacion.ocupacion": { $size: 0 } },
          { "segmentacion.ocupacion": usuario.ocupacion },
          { "segmentacion.ocupacion": { $exists: false } }
        ]
      });
    }

    // Filtro por busqueda en el título
    const busqueda = req.query.busqueda;
    if (busqueda) {
      filtros.$and.push({
        titulo: { $regex: new RegExp(busqueda, 'i') }
      });
    }

    // Si no hay ningún filtro, quitar el $and para evitar problemas
    const consulta = filtros.$and.length > 0 ? filtros : {};

    const encuestas = await Encuesta.find(consulta).sort({ fechaCreacion: -1 });

    // Obtener conteo de respuestas por encuesta
    const conteo = await Respuesta.aggregate([
      { $match: { encuesta: { $in: encuestas.map(e => e._id) } } },
      { $group: { _id: "$encuesta", total: { $sum: 1 } } }
    ]);

    const conteoMap = {};
    conteo.forEach(c => {
      conteoMap[c._id.toString()] = c.total;
    });

    // Agregar estadísticas a cada encuesta
    const encuestasConEstadisticas = encuestas.map(e => ({
      ...e.toObject(),
      totalRespuestas: conteoMap[e._id.toString()] || 0,
      cantidadPreguntas: e.preguntas.length
    }));

    res.render('encuestas/lista', { encuestas: encuestasConEstadisticas, busqueda });
  } catch (error) {
    console.error('Error al obtener encuestas:', error);
    req.flash('error', 'Error al cargar las encuestas.');
    res.redirect('/');
  }
});

// 📋 Ruta para ver una encuesta específica
router.use((req, res, next) => {
  if (!req.session.usuario) {
    req.flash('error', 'Debes iniciar sesión para acceder a encuestas.');
    return res.redirect('/login');
  }
  next();
});

// Ruta para que las entidades vean sus encuestas creadas
router.get('/mis_encuestas', async (req, res) => {
  try {
    // Solo las entidades deben acceder a esta ruta
    if (!req.session.usuario || req.session.usuario.rol !== 'entidad') {
      req.flash('error', 'Solo las entidades pueden acceder a esta sección.');
      return res.redirect('/encuestas');
    }

    // Buscar encuestas creadas por este usuario
    const encuestas = await Encuesta.find({ creadoPor: req.session.usuario.id });
    res.render('encuestas/mis-encuestas', { encuestas });
  } catch (error) {
    console.error('Error al obtener mis encuestas:', error);
    res.status(500).send('Error al obtener tus encuestas.');
  }
});
//ruta para editar 
router.get('/editar/:id', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    if (!encuesta) {
      req.flash('error', 'Encuesta no encontrada.');
      return res.redirect('/encuestas');
    }
    res.render('encuestas/editar', { encuesta });
  } catch (error) {
    console.error('Error al cargar la encuesta:', error);
    req.flash('error', 'Error al cargar la encuesta.');
    res.redirect('/encuestas');
  }
});
router.post('/editar/:id', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    if (!encuesta) {
      req.flash('error', 'Encuesta no encontrada.');
      return res.redirect('/encuestas');
    }

    encuesta.titulo = req.body.titulo;
    encuesta.descripcion = req.body.descripcion;
    encuesta.tipoEncuesta = req.body.tipoEncuesta;
    encuesta.preguntas = req.body.preguntas ? req.body.preguntas.map(p => ({
      texto: p.texto,
      tipo: p.tipo,
      opciones: p.opciones || [],
      escala: p.tipo === 'escala' ? { min: p.escalaMin, max: p.escalaMax } : null
    })) : [];

    encuesta.segmentacion = {
      edad: {
        min: req.body.edadMin ? parseInt(req.body.edadMin) : null,
        max: req.body.edadMax ? parseInt(req.body.edadMax) : null
      },
      departamento: req.body.departamento ? req.body.departamento.split(',').map(s => s.trim()) : [],
      ocupacion: req.body.ocupacion ? req.body.ocupacion.split(',').map(s => s.trim()) : []
    };

    await encuesta.save();
    req.flash('exito', 'Encuesta actualizada correctamente.');
    res.redirect('/encuestas');
  } catch (error) {
    console.error('Error al actualizar la encuesta:', error);
    req.flash('error', 'Hubo un problema al actualizar la encuesta.');
    res.redirect('/encuestas');
  }
});


//ruta para ver los detalles de una encuesta
router.get('/:id/ver', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    const usuarioId = req.session.usuario.id;

    const yaRespondida = await Respuesta.findOne({
      encuesta: encuesta._id,
      usuario: usuarioId
    });

    if (yaRespondida) {
      req.flash('error', 'Ya has respondido esta encuesta.');
      return res.redirect('/encuestas');
    }
    res.render('encuestas/ver', { encuesta });
  } catch (error) {
    console.error('Error al cargar la encuesta:', error);
    req.flash('error', 'Error al cargar la encuesta.');
    res.redirect('/encuestas');
  }
});

// Función para calcular análisis por pregunta
async function calcularAnalisisPorPregunta(encuestaId) {
  const encuesta = await Encuesta.findById(encuestaId);
  const respuestas = await Respuesta.find({ encuesta: encuestaId });

  // Si no hay respuestas, devolver arreglo vacío
  if (!respuestas || respuestas.length === 0) return [];

  const analisis = encuesta.preguntas.map(p => {
    if (p.tipo === 'cerrada') {
      // Conteo de opciones para preguntas cerradas
      const conteo = {};
      respuestas.forEach(r => {
        r.respuestas.forEach(x => {
          // Convertir ambos IDs a cadena para una comparación confiable
          if (String(x.preguntaId) === String(p._id)) {
            if (x.respuesta && x.respuesta.trim() !== "") {
              conteo[x.respuesta] = (conteo[x.respuesta] || 0) + 1;
            }
          }
        });
      });
      return {
        preguntaId: String(p._id),
        texto: p.texto,
        tipo: p.tipo,
        conteo
      };

    } else if (p.tipo === 'abierta') {
      // Recopilación de respuestas para preguntas abiertas
      const respuestasAbiertas = [];
      respuestas.forEach(r => {
        r.respuestas.forEach(x => {
          if (String(x.preguntaId) === String(p._id)) {
            if (x.respuesta && x.respuesta.trim() !== "") {
              respuestasAbiertas.push(x.respuesta.trim());
            }
          }
        });
      });
      return {
        preguntaId: String(p._id),
        texto: p.texto,
        tipo: p.tipo,
        respuestas: respuestasAbiertas
      };

    } else if (p.tipo === 'escala') {
      // Cálculo de promedio para preguntas de escala
      const valores = [];
      respuestas.forEach(r => {
        r.respuestas.forEach(x => {
          if (String(x.preguntaId) === String(p._id)) {
            const v = parseInt(x.respuesta, 10);
            if (!isNaN(v)) {
              valores.push(v);
            }
          }
        });
      });
      const promedio = valores.length > 0
        ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1)
        : 'N/A';

      return {
        preguntaId: String(p._id),
        texto: p.texto,
        tipo: p.tipo,
        promedio
      };
    }

    // Si el tipo de pregunta no es reconocido, no retornar nada
    return null;
  });

  // Eliminar elementos nulos (tipo desconocido)
  return analisis.filter(Boolean);
}

// POST para responder una encuesta
router.post('/:id/responder', async (req, res) => {
  try {
    const encuestaId = req.params.id;
    const usuarioId = req.session.usuario.id;

    const yaRespondida = await Respuesta.findOne({
      encuesta: encuestaId,
      usuario: usuarioId
    });
    if (yaRespondida) {
      req.flash('error', 'Ya has respondido esta encuesta.');
      return res.redirect('/encuestas');
    }

    // 💡 Convertir cada preguntaId en ObjectId
    const respuestasData = req.body.respuestas.map(r => ({
      preguntaId: new mongoose.Types.ObjectId(r.preguntaId),
      respuesta: r.respuesta
    }));

    await Respuesta.create({
      encuesta: encuestaId,
      usuario: usuarioId,
      respuestas: respuestasData,
      fecha: new Date()
    });

    // 🔄 Recalcular estadísticas y análisis (emisión en tiempo real)
    const io = req.app.get('io');
    if (io) {
      const respuestasPorSemana = await calcularRespuestasPorSemana(encuestaId);
      const distribucionEdad = await calcularDistribucionEdad(encuestaId);
      const analisisPreguntas = await calcularAnalisisPorPregunta(encuestaId);

      io.to(encuestaId).emit('actualizacionResultados', {
        respuestasPorSemana,
        distribucionEdad,
        analisisPreguntas
      });
    }

    req.flash('exito', 'Gracias por participar.');
    res.redirect('/encuestas');
  } catch (error) {
    console.error('Error al guardar respuestas:', error);
    req.flash('error', 'Ocurrió un error al enviar tus respuestas.');
    res.redirect(`/encuestas/${req.params.id}/ver`);
  }
});

// Ruta para ver resultados
router.get('/resultados/:id', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    const respuestas = await Respuesta.find({ encuesta: encuesta._id }).populate('usuario');

    const totalRespuestas = respuestas.length;
    const totalPreguntas = encuesta.preguntas.length;

    // 📊 Agrupar respuestas por semana
    const respuestasPorSemana = {};
    respuestas.forEach(r => {
      const semana = new Date(r.fecha).toISOString().slice(0, 10);
      respuestasPorSemana[semana] = (respuestasPorSemana[semana] || 0) + 1;
    });

    // 📊 Distribución por edad
    const edades = respuestas.map(r => r.usuario.edad); // Se asume que Usuario tiene campo "edad"
    const distribucionEdad = { '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0 };
    edades.forEach(e => {
      if (e < 26) distribucionEdad['18-25']++;
      else if (e < 36) distribucionEdad['26-35']++;
      else if (e < 51) distribucionEdad['36-50']++;
      else distribucionEdad['51+']++;
    });

    // Calcular el análisis por pregunta para la vista inicial
    const analisisPreguntas = await calcularAnalisisPorPregunta(encuesta._id);

    res.render('encuestas/resultados', {
      encuesta,
      totalRespuestas,
      totalPreguntas,
      respuestasPorSemana,
      distribucionEdad,
      respuestas,
      analisisPorPregunta: analisisPreguntas  // <--- Cambio aquí
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'No se pudo cargar resultados');
    res.redirect('/encuestas');
  }
});
//ruta para que usuarios vean sus respuestas
router.get('/mis-respuestas', async (req, res) => {
  try {
    if (!req.session.usuario) {
      req.flash('error', 'Debes iniciar sesión para ver tus respuestas.');
      return res.redirect('/login');
    }

    const usuarioId = req.session.usuario.id;

    const respuestas = await Respuesta.find({ usuario: usuarioId })
      .populate('encuesta');

    res.render('encuestas/mis-respuestas', { respuestas });
  } catch (error) {
    console.error('Error al cargar respuestas del usuario:', error);
    req.flash('error', 'No se pudieron cargar tus respuestas.');
    res.redirect('/encuestas');
  }
});
// Exportar respuestas en JSON
router.get('/:id/exportar/json', async (req, res) => {
  try {
    const respuestas = await Respuesta.find({ encuesta: req.params.id }).populate('usuario');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=respuestas.json');
    res.send(JSON.stringify(respuestas, null, 2));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al exportar JSON');
  }
});
router.get('/:id/exportar/csv', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    const respuestas = await Respuesta.find({ encuesta: req.params.id }).populate('usuario');

    const mapaPreguntas = {};
    encuesta.preguntas.forEach(p => {
      mapaPreguntas[String(p._id)] = p.texto;
    });

    const datos = respuestas.flatMap(r =>
      r.respuestas.map(p => ({
        usuario: r.usuario?.nombre || 'Anónimo',
        edad: r.usuario?.edad || '',
        departamento: r.usuario?.departamento || '',
        ocupacion: r.usuario?.ocupacion || '',
        pregunta: mapaPreguntas[String(p.preguntaId)] || '[Pregunta desconocida]',
        respuesta: p.respuesta,
        fecha: r.fecha.toISOString().slice(0, 10)
      }))
    );

    const { Parser } = require('json2csv');
    const json2csv = new Parser({
      fields: ['usuario', 'edad', 'departamento', 'ocupacion', 'pregunta', 'respuesta', 'fecha']
    });
    const csv = json2csv.parse(datos);

    res.header('Content-Type', 'text/csv');
    res.attachment('respuestas_segmentadas.csv');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al exportar CSV con segmentación');
  }
});
router.get('/:id/exportar/pdf', async (req, res) => {
  const encuestaId = req.params.id;
  const url = `${req.protocol}://${req.get('host')}/encuestas/resultados/${encuestaId}`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // PASO 1: Transferir cookie de sesión
  const sessionCookie = req.headers.cookie; // extrae cookies de la sesión actual
  if (sessionCookie) {
    const cookies = sessionCookie.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return {
        name,
        value: rest.join('='),
        domain: req.hostname, // asegúrate de que sea correcto si usas dominios reales
        path: '/',
      };
    });
    await page.setCookie(...cookies);
  }

  // PASO 2: Navegar a la página de resultados
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Espera para cargar gráficos
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generar el PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true
  });

  await browser.close();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="resultados_encuesta_${encuestaId}.pdf"`,
    'Content-Length': pdf.length
  });

  res.send(pdf);
});


router.get('/:id/pdf-preview', async (req, res) => {
  try {
    const encuesta = await Encuesta.findById(req.params.id);
    const respuestas = await Respuesta.find({ encuesta: encuesta._id }).populate('usuario');

    const respuestasPorSemana = {};
    respuestas.forEach(r => {
      const semana = new Date(r.fecha).toISOString().slice(0, 10);
      respuestasPorSemana[semana] = (respuestasPorSemana[semana] || 0) + 1;
    });

    const edades = respuestas.map(r => r.usuario.edad);
    const distribucionEdad = { '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0 };
    edades.forEach(e => {
      if (e < 26) distribucionEdad['18-25']++;
      else if (e < 36) distribucionEdad['26-35']++;
      else if (e < 51) distribucionEdad['36-50']++;
      else distribucionEdad['51+']++;
    });

    const analisisPreguntas = await calcularAnalisisPorPregunta(encuesta._id);

    res.render('encuestas/resultados-pdf', {
      encuesta,
      respuestasPorSemana,
      distribucionEdad,
      analisisPorPregunta: analisisPreguntas
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al generar vista PDF');
  }
});

module.exports = router;
