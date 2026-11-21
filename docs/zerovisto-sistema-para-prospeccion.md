# ZeroVisto: ficha completa del sistema para el buscador de prospectos

> Documento de referencia para un sistema automático de búsqueda y calificación de prospectos.
> Explica qué es ZeroVisto, qué hace, cuánto cuesta, a quién le sirve, cómo detectar a un buen prospecto,
> cómo puntuarlo y cómo abordarlo. Al final hay un bloque JSON con los mismos datos en formato estructurado.
>
> Fuente: el código y la landing en producción (zerovistochile.com), noviembre de 2026.
> Precios en pesos chilenos (CLP), IVA incluido.

---

## 1. Qué es ZeroVisto, en una frase

**ZeroVisto es un agente de inteligencia artificial que atiende el WhatsApp y el Instagram de un negocio chileno las 24 horas: responde en segundos, agenda horas, reserva mesas, toma pedidos y cobra, para que ningún cliente quede "en visto" y se vaya con la competencia.**

- Marca: ZeroVisto ("Cero clientes en visto").
- Sitio: https://zerovistochile.com
- Empresa: ZERO SYSTEM TECHNOLOGIES SpA, RUT 78.532.482-K, Quilpué, Región de Valparaíso, Chile.
- Mercado: pymes y comercios de Chile que atienden clientes por WhatsApp o Instagram.
- Idioma del agente: español de Chile, de "tú" (nunca voseo argentino), con trato cercano o formal según el negocio.

## 2. El problema que resuelve (el dolor del prospecto)

El dueño de un negocio pequeño pierde clientes por dos razones que reconoce de su día a día:

1. **Contesta tarde.** Está atendiendo, cocinando o con las manos ocupadas, y el WhatsApp se acumula. Cuando responde, horas después, el cliente ya agendó o compró en otra parte.
2. **Su local está cerrado.** Cierra a las 20:00, pero los clientes siguen escribiendo de noche, el domingo y los feriados. El mensaje espera hasta mañana, y mañana ya eligieron a otro.

El cliente final se va con el primero que contesta. **ZeroVisto contesta primero, siempre.**

## 3. La solución (propuesta de valor)

- **Atiende 24/7**: noches, fines de semana y feriados.
- **Responde en segundos**: mediana de 3,3 segundos medida en respuestas reales.
- **Hace el trabajo, no solo conversa**: agenda la hora, reserva la mesa, registra el pedido, manda los datos de pago, verifica el comprobante.
- **No inventa**: solo afirma lo que el negocio cargó (precios, horarios, servicios, stock). Si no sabe algo, lo dice o pasa el caso a una persona.
- **Deriva a una persona** cuando corresponde (reclamo, caso delicado, el cliente lo pide) y le avisa al equipo con todo el contexto.
- **Todo queda en un panel**: conversaciones, horas agendadas, pedidos, cobros, inventario, resumen del negocio.

Beneficios que se comunican:
| Beneficio | Explicación para el dueño |
|---|---|
| Ahorro de personal | Las preguntas de siempre (precio, horario, dirección, stock) las contesta el agente. El equipo deja de vivir pegado al teléfono. |
| Ventas fuera de horario | El cliente que escribe a las 23:47 no se va con la competencia. |
| Respuesta al tiro | Segundos, no horas. Menos clientes aburridos de esperar. |
| Agenda y pedidos en orden | Todo registrado en el panel. Nada de libretas, capturas de pantalla ni mensajes perdidos. |
| Misma información para todos | Los mismos precios y condiciones para cada cliente, sin errores al copiar. |
| Equipo solo en lo importante | Los reclamos y casos delicados llegan a una persona con todo el contexto. |

## 4. Qué hace el sistema (funciones completas)

### 4.1 Canales
- **WhatsApp Business** (API oficial de Meta, número verificado del negocio).
- **Instagram** (mensajes directos).
- **Notas de voz**: escucha y entiende los audios que manda el cliente.
- WhatsApp e Instagram se atienden desde un solo panel.

### 4.2 Conversación con IA
- Entiende lenguaje natural (no es un bot de botones ni un menú de opciones).
- Usa la información del negocio: carta o servicios, precios, horarios, dirección, preguntas frecuentes.
- Recuerda lo que va aprendiendo de cada cliente (ficha del contacto).
- Se pausa sola si el cliente reclama o pide una persona. El dueño responde desde el panel y luego le devuelve la conversación al agente.
- Si la IA falla o la plataforma está en mantención, el cliente recibe un mensaje claro y nada se pierde.

### 4.3 Agenda (rubros de servicios)
- Consulta la disponibilidad real y agenda horas en el calendario del negocio.
- Maneja equipo: el cliente puede pedir que lo atienda una persona específica ("que me atienda Camila").
- Si escriben fuera de horario, ofrece de inmediato las próximas horas libres.

### 4.4 Reservas de mesa (restaurantes)
- El restaurante dibuja el plano del salón: mesas, ventanas, lado sol o sombra, pisos, terraza.
- El agente reserva la mesa exacta según la preferencia del cliente ("junto a la ventana", "a la sombra") y le cuenta dónde queda.
- Avisa la tolerancia (por ejemplo, la mesa se guarda 15 minutos).

### 4.5 Pedidos y catálogo (comida, tiendas)
- Catálogo con precios, fotos y stock.
- **Carga de la carta en un paso**: se sube una foto, un PDF o un Excel de la carta y el sistema reconoce productos y precios. También se puede cargar a mano o importar desde WooCommerce o Jumpseller.
- El agente muestra la carta, toma el pedido, calcula el total y descuenta el stock.
- No vende lo agotado: lo dice y ofrece otra opción.

### 4.6 Cobros
- **Cobro antes de preparar** (opcional): el agente entrega los datos de transferencia o un link de **Mercado Pago**. El pedido entra a cocina recién pagado. Si no pagan a tiempo, se anula solo y el stock vuelve.
- **Lectura de comprobantes**: el cliente manda la foto de la transferencia y el sistema revisa monto, cuenta o RUT de destino, fecha y estado, y que el código de operación no se haya usado antes. La confirmación automática es opcional.
- ZeroVisto no toca la plata: cada local cobra en su propia cuenta.

### 4.7 Cocina e inventario (locales de comida, todo opcional)
- **Ticket de cocina**: pantalla de cocina que muestra e imprime el ticket de cada pedido pagado (impresora térmica de 80 mm o normal).
- **Horario para recibir pedidos**: solo en horario de atención, con margen para recibir antes de abrir (por ejemplo, desde las 18:00 para preparar a las 19:00) o para dejar de recibir antes de cerrar.
- **Inventario de materia prima con recetas y costos**: ingredientes, compras, recetas por producto. Cada venta descuenta lo que usa y el agente deja de ofrecer lo que no alcanza a prepararse. El panel muestra el costo y el margen de cada producto, las ventas, las compras y las mermas.
- **Alertas**: aviso dentro del panel y correo cuando un ingrediente o producto se acaba o baja del mínimo.

### 4.8 Panel del negocio
- Resumen del negocio de un vistazo (conversaciones, horas agendadas, pedidos, ventas, agotados, cupo usado).
- Simulador para probar al agente antes de conectarlo.
- Guía paso a paso para dejarlo listo.
- Varios negocios en una misma cuenta, con dueños y equipo con roles distintos.

### 4.9 Seguridad y cumplimiento
- Datos separados por negocio: lo de uno nunca se mezcla con lo de otro.
- Credenciales cifradas.
- Términos de servicio y política de privacidad conforme a la Ley 19.628 (Chile).

## 5. Precios

### 5.1 Mensualidad (IVA incluido, sin permanencia)
| Plan | Precio mensual | Negocios incluidos | Respuestas del agente al mes | Para quién |
|---|---|---|---|---|
| **Básico** (recomendado) | **$45.000** | 1 | 1.500 | Un local que quiere dejar de perder clientes en visto |
| **Negocios** | **$95.000** | hasta 3 | 4.000 | Quien maneja más de un local o marca |
| **Ilimitado** | **$160.000** | sin límite | 10.000 | Agencias y cadenas con muchos negocios |

Todos los planes incluyen atención 24/7, agenda, reservas de mesa, pedidos, notas de voz, y WhatsApp e Instagram en un solo panel.

### 5.2 Implementación (pago único al empezar, IVA incluido)
| Nivel | Precio | Qué incluye | Negocios típicos |
|---|---|---|---|
| **Simple** | **$150.000** | Responde, agenda horas o toma pedidos por WhatsApp. Sin cobrar por el chat. | Peluquería, uñas, taller, consulta |
| **Estándar** (el más común) | **$190.000** | Lo anterior, y además cobra por el chat (transferencia o Mercado Pago) y avisa a la cocina o cuando se acaba el stock. | Food truck, tienda, pastelería, delivery |
| **Avanzado** | **$250.000** | Restaurante completo: reservas de mesa en el plano del local, pedidos, cobros, y WhatsApp e Instagram juntos. | Restaurante con salón y terraza |

- Cada **local adicional** del mismo cliente: **$90.000** (se reutiliza la configuración).
- La implementación incluye: conectar el WhatsApp y dejarlo verificado ante Meta, cargar la carta o servicios, precios, horarios y preguntas frecuentes, y probarlo junto al cliente antes de que hable con sus clientes.
- **No hay plan gratis.** El modelo es implementación más mensualidad.
- **Sin permanencia**: se cancela cuando se quiera y se usa hasta el final del mes pagado. No hay devoluciones proporcionales.

### 5.3 Argumento de retorno
- Si cada hora agendada o pedido le deja $20.000 al negocio, **el plan Básico se paga con 3 clientes que antes se perdían**.
- Ejemplo completo: un food truck en plan Básico paga $190.000 una vez al empezar y después $45.000 al mes. Nada más.
- Referencia de mercado: las herramientas de WhatsApp de la competencia (Whaticket, Callbell, Landbot) cuestan entre $47.000 y $170.000 al mes y son bots de opciones, no IA. Las implementaciones de agentes con IA para pymes en Chile parten desde $300.000.

## 6. Cliente ideal (ICP)

### 6.1 Rubros que atiende (plantillas listas en el sistema)
| Rubro | Qué hace el agente | Nivel de implementación sugerido |
|---|---|---|
| Manicura / uñas / depilación | Agenda horas, con quién y precios por servicio | Simple |
| Peluquería / barbería | Agenda horas por profesional | Simple |
| Odontología / consultas | Agenda, distingue urgencias y las prioriza | Simple |
| Taller mecánico | Recibe consultas, agenda revisión, explica servicios | Simple |
| Gimnasio / entrenamiento | Planes, horarios, clases de prueba | Simple |
| Estudio jurídico | Primera consulta, agenda, deriva casos | Simple |
| Inmobiliaria | Requisitos, comisiones, zonas, agenda visitas | Simple |
| Food truck / comida rápida / sushi / pizzas / completos / delivery | Carta, pedidos, cobro, cocina, horario de pedidos, inventario | Estándar |
| Tienda / e-commerce / pastelería | Catálogo, stock, pedidos y cobro | Estándar |
| Restaurante con salón o terraza | Reservas en el plano del local, pedidos, cobros, WhatsApp e Instagram | Avanzado |
| Otro rubro | Plantilla general adaptable | Según lo que active |

### 6.2 Perfil
- Ubicación: **Chile** (zona horaria de Chile, español chileno, pagos con transferencia chilena o Mercado Pago).
- Tamaño: pyme o microempresa, de 1 a 3 locales (plan Básico o Negocios). Cadenas y agencias, plan Ilimitado.
- Canal: **ya recibe clientes por WhatsApp o Instagram** (condición casi obligatoria).
- Quién decide: el dueño o dueña del local. Suele ser quien contesta el WhatsApp.

## 7. Señales para detectar un buen prospecto

Señales fuertes (positivas):
1. Su Instagram, Google Maps o web dice "escríbenos al WhatsApp", "pedidos por DM" o "reservas por WhatsApp", o tiene un link wa.me.
2. Atiende con horario acotado (cierra temprano, no abre domingo), pero recibe consultas fuera de ese horario.
3. Reseñas en Google que mencionan "no contestan", "tardan en responder", "nunca respondieron el WhatsApp".
4. Publica la carta o lista de precios en historias o en fotos (se carga directo con foto o PDF).
5. Toma pedidos para retiro o delivery por chat (food truck, sushi, completos, pizzas, pastelería).
6. Agenda horas a mano por chat (uñas, peluquería, barbería, dentista, estética).
7. Restaurante que recibe reservas por mensaje directo.
8. Comentarios en sus publicaciones preguntando precio o disponibilidad que quedan sin responder.
9. Tiene más de un local o marca (sube a plan Negocios).
10. Negocio activo y con movimiento (publicaciones recientes, reseñas recientes).

Señales negativas (descalificar o bajar prioridad):
- No usa WhatsApp ni Instagram para atender clientes (solo teléfono fijo o presencial).
- Ya tiene un sistema de reservas o pedidos online completo con chat atendido, y no muestra problemas de respuesta.
- Negocio fuera de Chile.
- Negocio cerrado o sin actividad reciente.
- Gran empresa con call center propio (otro ciclo de venta).

## 8. Rúbrica de puntaje sugerida (0 a 100)

| Criterio | Puntos |
|---|---|
| Atiende por WhatsApp o Instagram (visible en bio, web o Maps) | 25 |
| Rubro de la tabla 6.1 | 15 |
| Señales de respuesta lenta o mensajes sin contestar (reseñas, comentarios) | 15 |
| Horario acotado (cierra temprano o fines de semana) | 10 |
| Toma pedidos, reservas o agenda por chat | 15 |
| Publica carta o precios (implementación rápida) | 5 |
| Más de un local o marca | 5 |
| Actividad reciente (últimos 30 días) | 10 |

Prioridad: **70 o más = caliente** (contactar primero) · **45 a 69 = tibio** · **menos de 45 = frío**.

## 9. Cómo abordarlo

### 9.1 Llamado a la acción principal
**Que el prospecto pruebe un bot en vivo desde su propio WhatsApp.** Funciona mejor que cualquier explicación.

Bots de demostración (negocios ficticios atendidos por el sistema real):
| Bot | Rubro | WhatsApp | Qué probar |
|---|---|---|---|
| Studio Glam | Uñas y depilación | +56 9 3663 6559 | Pedir una hora para mañana · Pedir que te atienda Camila · Preguntar cuánto sale el semipermanente |
| Altura Bistró | Restaurante | +56 9 4893 4972 | Reservar una mesa junto a la ventana · Pedir sombra para el almuerzo · Preguntar qué se ve desde la terraza |
| Pancho Rodante | Food truck | +56 9 3485 0293 | Pedir la carta · Hacer un pedido para retirar · Preguntar si queda algo agotado |

Elegir el bot del rubro más parecido al prospecto.

### 9.2 Contacto comercial
- WhatsApp de ventas (atendido por el propio agente de ZeroVisto): **+56 9 3036 1852** → https://wa.me/56930361852
- Teléfono: +56 9 2044 8651
- Correo: contacto@zerovistochile.com
- Sitio: https://zerovistochile.com (precios y bots en vivo a la vista, sin registro)

### 9.3 Mensaje base (adaptar al rubro, corto, en español de Chile, de "tú")
> Hola, [nombre del local] 👋 Vi que atienden pedidos/horas por WhatsApp. ¿Qué pasa con los clientes que escriben cuando están ocupados o con el local cerrado? Con ZeroVisto, un agente con IA les responde en segundos, 24/7, y les deja [la hora agendada / el pedido tomado / la mesa reservada]. Pruébalo tú mismo como si fueras cliente: [link del bot del rubro]. Si te sirve, te lo dejamos funcionando con tu carta y tus horarios.

Ganchos por rubro:
- **Comida**: "El que escribe a las 23:00 pidiendo la carta, ¿se queda sin pedir?". Mencionar la carta cargada desde foto, el cobro antes de preparar y el inventario.
- **Belleza y salud**: "¿Cuántas horas se pierden porque contestas al otro día?". Mencionar la agenda por profesional.
- **Restaurantes**: "Reservas en plena hora peak sin dejar de atender el salón". Mencionar el plano del local y la preferencia de ventana o terraza.
- **Talleres y servicios**: "Que el cliente reciba respuesta mientras estás bajo el auto".

### 9.4 Objeciones frecuentes y respuesta
| Objeción | Respuesta |
|---|---|
| "Es caro" | $45.000 al mes. Se paga con 3 clientes que antes se perdían. Menos que media jornada de una persona contestando. |
| "Va a responder cualquier cosa / va a inventar" | Solo responde con lo que el negocio carga. Si no sabe, lo dice o pasa el caso a una persona. Se prueba en el simulador antes de conectarlo. |
| "A mis clientes les gusta hablar con una persona" | Cuando alguien reclama o pide una persona, el agente se pausa y el equipo responde desde el panel con todo el contexto. |
| "No tengo tiempo para configurarlo" | La implementación la hacemos nosotros: conectamos el WhatsApp, cargamos la carta (basta una foto) y lo probamos juntos. |
| "¿Y si no me sirve?" | No hay permanencia: se cancela cuando se quiera. Antes de pagar puedes probar los bots en vivo. |
| "Ya uso un bot de opciones" | Esos bots hacen elegir números en un menú. ZeroVisto entiende lo que escribe el cliente (y sus audios) y además agenda, vende y cobra. |
| "¿Pierdo mi número de WhatsApp?" | Se usa el número del negocio, conectado a la API oficial de Meta. |

### 9.5 Buenas prácticas de contacto (obligatorias)
- Contactar uno a uno, con un mensaje personalizado al negocio. Nada de envíos masivos ni spam.
- Usar solo datos de contacto que el negocio publica para atender clientes (bio, Maps, web).
- Si el prospecto pide no ser contactado, registrarlo y no volver a escribirle (Ley 19.628 de protección de datos personales).
- No prometer resultados en cifras ("vas a vender X% más"). El argumento es el comportamiento que todos conocen: el cliente se va con el primero que contesta.

## 10. Cómo empieza un cliente (proceso)
1. **Elige su rubro**: el agente parte con el tono y las preguntas de ese tipo de negocio.
2. **Carga su información**: precios, horarios, servicios y productos. La carta se sube en foto, PDF o Excel, o se trae desde su sitio o su Instagram.
3. **Conecta sus canales**: WhatsApp Business o Instagram. Antes lo prueba en el simulador.
4. **Se dedica a su negocio**: el agente atiende, y el dueño recibe las horas agendadas, los pedidos registrados y los casos que necesitan a una persona.

---

## 11. Datos estructurados (JSON)

```json
{
  "producto": "ZeroVisto",
  "tagline": "Cero clientes en visto",
  "descripcion": "Agente de IA que atiende WhatsApp e Instagram de negocios chilenos 24/7: responde en segundos, agenda horas, reserva mesas, toma pedidos, cobra y verifica comprobantes.",
  "sitio": "https://zerovistochile.com",
  "empresa": { "razon_social": "ZERO SYSTEM TECHNOLOGIES SpA", "rut": "78.532.482-K", "ciudad": "Quilpué", "region": "Región de Valparaíso", "pais": "Chile" },
  "contacto": {
    "whatsapp_ventas": "+56930361852",
    "whatsapp_ventas_link": "https://wa.me/56930361852",
    "telefono": "+56920448651",
    "email": "contacto@zerovistochile.com"
  },
  "mercado": { "pais": "CL", "idioma": "es-CL", "moneda": "CLP", "precios_incluyen_iva": true },
  "metricas": { "disponibilidad": "24/7", "respuesta_mediana_segundos": 3.3 },
  "canales": ["WhatsApp Business (API oficial de Meta)", "Instagram DM", "Notas de voz"],
  "funciones": [
    "Conversación con IA en lenguaje natural, sin menús",
    "Responde solo con la información cargada; no inventa",
    "Derivación a una persona con aviso al equipo",
    "Agenda de horas con disponibilidad real y por profesional",
    "Reservas de mesa sobre el plano del local (ventana, sol/sombra, pisos)",
    "Catálogo con stock; no vende lo agotado",
    "Carga de la carta desde foto, PDF o Excel; importación WooCommerce/Jumpseller",
    "Pedidos con total y descuento de stock",
    "Cobro antes de preparar: transferencia o Mercado Pago",
    "Lectura y verificación de comprobantes de transferencia",
    "Ticket de cocina con impresión",
    "Horario para recibir pedidos (antes de abrir / antes de cerrar)",
    "Inventario de materia prima con recetas, costos y márgenes",
    "Alertas de stock en el panel y por correo",
    "Panel con resumen, simulador y guía paso a paso",
    "Varios negocios por cuenta, con roles de dueño y equipo"
  ],
  "planes_mensuales": [
    { "plan": "Básico", "precio_clp": 45000, "negocios": 1, "respuestas_mes": 1500, "recomendado": true },
    { "plan": "Negocios", "precio_clp": 95000, "negocios": 3, "respuestas_mes": 4000 },
    { "plan": "Ilimitado", "precio_clp": 160000, "negocios": null, "respuestas_mes": 10000 }
  ],
  "implementacion_pago_unico": [
    { "nivel": "Simple", "precio_clp": 150000, "incluye": "Responde, agenda horas o toma pedidos por WhatsApp, sin cobro por chat", "ejemplos": ["peluquería", "uñas", "taller", "consulta"] },
    { "nivel": "Estándar", "precio_clp": 190000, "mas_comun": true, "incluye": "Lo anterior más cobro por chat (transferencia o Mercado Pago) y avisos de cocina/stock", "ejemplos": ["food truck", "tienda", "pastelería", "delivery"] },
    { "nivel": "Avanzado", "precio_clp": 250000, "incluye": "Restaurante completo: reservas en el plano, pedidos, cobros, WhatsApp e Instagram", "ejemplos": ["restaurante con salón y terraza"] }
  ],
  "local_adicional_clp": 90000,
  "plan_gratis": false,
  "permanencia_minima": false,
  "roi": "Con un ticket de $20.000, el plan Básico se paga con 3 clientes recuperados al mes",
  "rubros_objetivo": [
    { "rubro": "Manicura / uñas / depilación", "nivel": "Simple" },
    { "rubro": "Peluquería / barbería", "nivel": "Simple" },
    { "rubro": "Odontología / consultas", "nivel": "Simple" },
    { "rubro": "Taller mecánico", "nivel": "Simple" },
    { "rubro": "Gimnasio / entrenamiento", "nivel": "Simple" },
    { "rubro": "Estudio jurídico", "nivel": "Simple" },
    { "rubro": "Inmobiliaria", "nivel": "Simple" },
    { "rubro": "Food truck / comida rápida / sushi / pizzas / completos / delivery", "nivel": "Estándar" },
    { "rubro": "Tienda / e-commerce / pastelería", "nivel": "Estándar" },
    { "rubro": "Restaurante con salón o terraza", "nivel": "Avanzado" }
  ],
  "senales_positivas": [
    "Bio, web o Maps dice 'escríbenos al WhatsApp', 'pedidos por DM' o 'reservas por WhatsApp', o tiene link wa.me",
    "Horario acotado con consultas fuera de horario",
    "Reseñas que mencionan que no contestan o tardan en responder",
    "Publica la carta o lista de precios en fotos o historias",
    "Toma pedidos para retiro o delivery por chat",
    "Agenda horas a mano por chat",
    "Recibe reservas de mesa por mensaje",
    "Comentarios con preguntas de precio o disponibilidad sin respuesta",
    "Más de un local o marca",
    "Actividad reciente"
  ],
  "senales_negativas": [
    "No atiende por WhatsApp ni Instagram",
    "Ya tiene reservas/pedidos online completos y responde rápido",
    "Fuera de Chile",
    "Negocio cerrado o inactivo",
    "Gran empresa con call center propio"
  ],
  "puntaje": {
    "criterios": [
      { "criterio": "Atiende por WhatsApp o Instagram", "puntos": 25 },
      { "criterio": "Rubro objetivo", "puntos": 15 },
      { "criterio": "Señales de respuesta lenta", "puntos": 15 },
      { "criterio": "Horario acotado", "puntos": 10 },
      { "criterio": "Pedidos, reservas o agenda por chat", "puntos": 15 },
      { "criterio": "Publica carta o precios", "puntos": 5 },
      { "criterio": "Más de un local", "puntos": 5 },
      { "criterio": "Actividad en los últimos 30 días", "puntos": 10 }
    ],
    "umbrales": { "caliente": 70, "tibio": 45 }
  },
  "bots_demo": [
    { "nombre": "Studio Glam", "rubro": "Uñas y depilación", "whatsapp": "+56936636559", "link": "https://wa.me/56936636559", "probar": ["Pide una hora para mañana", "Pide que te atienda Camila", "Pregunta cuánto sale el semipermanente"] },
    { "nombre": "Altura Bistró", "rubro": "Restaurante", "whatsapp": "+56948934972", "link": "https://wa.me/56948934972", "probar": ["Reserva una mesa junto a la ventana", "Pide sombra para el almuerzo", "Pregunta qué se ve desde la terraza"] },
    { "nombre": "Pancho Rodante", "rubro": "Food truck", "whatsapp": "+56934850293", "link": "https://wa.me/56934850293", "probar": ["Pide la carta", "Haz un pedido para retirar", "Pregunta si queda algo agotado"] }
  ],
  "competencia": {
    "referencias": ["Whaticket", "Callbell", "Landbot"],
    "rango_precio_mensual_clp": [47000, 170000],
    "diferencia": "Son bots de opciones (menús); ZeroVisto es IA que entiende texto y audios, y además agenda, vende, cobra e inventaría."
  },
  "reglas_contacto": [
    "Uno a uno y personalizado; sin envíos masivos",
    "Solo datos de contacto públicos para atención de clientes",
    "Respetar a quien pide no ser contactado (Ley 19.628)",
    "No prometer resultados en cifras"
  ]
}
```
