# ANEXO A — ACUERDO DE TRATAMIENTO DE DATOS PERSONALES

**Forma parte integrante del Contrato de Prestación de Servicios suscrito entre ZERO SYSTEM
TECHNOLOGIES SpA y [Cliente].**

> **Por qué existe este anexo:** la Ley N° 21.719, que reemplaza a la Ley N° 19.628, exige que la
> relación entre el responsable de los datos y quien los trata por su cuenta conste **por escrito**.
> Sin este anexo firmado, el Cliente queda expuesto frente a la Agencia de Protección de Datos
> Personales. Hazlo revisar por un abogado junto con el contrato principal.

---

## 1. Roles de cada parte

| | Datos del Cliente y su equipo | Datos de los clientes finales |
|---|---|---|
| **Responsable** | ZeroVisto | **El Cliente** |
| **Encargado** | — | **ZeroVisto** |

Respecto de los **datos de los clientes finales** —las personas que escriben al negocio del
Cliente por WhatsApp o Instagram—, el Cliente decide para qué se tratan y ZeroVisto los trata
**únicamente por cuenta del Cliente y siguiendo sus instrucciones**.

## 2. Objeto, naturaleza y finalidad del tratamiento

| Concepto | Detalle |
|---|---|
| **Objeto** | Operar el agente de atención automatizada y el panel de gestión del Cliente. |
| **Naturaleza** | Recolección, almacenamiento, consulta, uso, comunicación a los subencargados del punto 6, y supresión. |
| **Finalidad** | Responder los mensajes de los clientes finales, agendar horas, reservar mesas, tomar pedidos y mantener el historial de conversaciones. |
| **Duración** | Mientras esté vigente el Contrato, más los plazos de supresión del punto 10. |

ZeroVisto **no** usa estos datos para fines propios, **no** los vende, **no** los usa con fines
publicitarios y **no** entrena modelos de inteligencia artificial propios con ellos.

## 3. Categorías de datos y de titulares

**Titulares:** clientes finales y potenciales clientes del Cliente que se comunican por los canales
conectados.

**Datos tratados:**
- Nombre de contacto.
- Número de teléfono o nombre de usuario del canal.
- Contenido de los mensajes intercambiados con el agente.
- Transcripción de las notas de voz recibidas (el audio no se almacena).
- Datos que el propio titular entregue en la conversación: fecha y hora de una reserva, servicio o
  producto solicitado, preferencias indicadas y la persona del equipo que pidió que lo atienda.

**No se solicitan ni se requieren datos sensibles.** Si el Cliente opera en un rubro donde el
titular pueda espontáneamente mencionar datos de salud u otros datos sensibles, es responsabilidad
del Cliente definir instrucciones y resguardos adicionales, e informarlo a ZeroVisto por escrito.

## 4. Instrucciones del responsable

1. ZeroVisto trata los datos **solo conforme a las instrucciones documentadas del Cliente**, que
   son: (i) este Anexo, (ii) el Contrato, y (iii) la configuración que el Cliente defina en el
   panel (información del negocio, base de conocimiento, objetivos y tono del agente, servicios,
   equipo, catálogo y horarios).
2. ZeroVisto informará al Cliente si, en su opinión, una instrucción infringe la normativa de
   protección de datos.
3. ZeroVisto no comunicará los datos a terceros distintos de los subencargados del punto 6, salvo
   obligación legal. En ese caso informará al Cliente antes, a menos que la ley lo prohíba.

## 5. Confidencialidad y personal

El personal de ZeroVisto que accede a los datos está sujeto a **deber de confidencialidad**, que
subsiste tras el término de su relación. El acceso se otorga **solo a quien lo necesita** para
operar o dar soporte, y queda registrado.

## 6. Subencargados

El Cliente **autoriza** a ZeroVisto a recurrir a los siguientes subencargados, todos vinculados por
obligaciones de protección equivalentes a las de este Anexo:

| Subencargado | Para qué | Dónde |
|---|---|---|
| **Meta Platforms** | Canal de entrada y salida de los mensajes (WhatsApp Business Platform, Instagram Messaging) | EE. UU. / Irlanda |
| **Vercel** | Alojamiento y ejecución de la aplicación | EE. UU. |
| **Supabase** | Base de datos | EE. UU. |
| **Proveedor de inteligencia artificial configurado** | Generar la respuesta del agente y transcribir notas de voz | EE. UU. |
| **Stripe** | Procesar los pagos de la suscripción | EE. UU. / Irlanda |
| **Proveedor de correo SMTP configurado** | Enviar los correos operativos de la cuenta | EE. UU. |

ZeroVisto avisará al Cliente **con 30 días de anticipación** antes de incorporar o reemplazar un
subencargado. Si el Cliente se opone por un motivo razonable y fundado en protección de datos,
podrá poner término al Contrato sin multa antes de que el cambio entre en vigencia.

## 7. Transferencias internacionales

Todos los subencargados operan servidores **fuera de Chile**, por lo que el servicio implica una
transferencia internacional de datos. ZeroVisto se obliga a mantener con cada uno garantías
contractuales de protección adecuadas, conforme al Título VIII de la Ley N° 21.719, y a acreditarlo
al Cliente cuando éste lo solicite.

## 8. Medidas de seguridad

ZeroVisto aplica, como mínimo, las siguientes medidas técnicas y organizativas, efectivamente
implementadas en la plataforma:

1. **Cifrado en tránsito:** todo el tráfico viaja por HTTPS/TLS.
2. **Cifrado de credenciales de canal:** los tokens de acceso a WhatsApp e Instagram se almacenan
   cifrados con **AES-256-GCM**.
3. **Contraseñas:** se almacenan derivadas con **scrypt** y sal única, nunca en texto plano.
4. **Sesiones:** cookies `httpOnly` firmadas, con listado y cierre de sesiones activas por el
   propio usuario, y **segundo factor (TOTP)** disponible.
5. **Verificación de origen:** los webhooks de Meta se validan por **firma criptográfica** antes de
   procesarse; los de Stripe, por su firma.
6. **Aislamiento entre clientes:** cada negocio solo accede a sus propios datos. La autorización se
   verifica en cada ruta de la API contra la base de datos, y está **cubierta por pruebas
   automatizadas** que intentan el acceso cruzado y verifican que se rechace.
7. **Defensa contra fuerza bruta:** límite de intentos de inicio de sesión por IP.
8. **Reserva sin duplicados:** las reservas se confirman dentro de transacciones con bloqueo, para
   impedir dobles asignaciones.
9. **Gestión de vulnerabilidades:** revisión periódica de las dependencias y aplicación de
   actualizaciones de seguridad.
10. **Respaldos:** copias de seguridad de la base de datos con rotación a 30 días.

## 9. Brechas de seguridad

1. ZeroVisto notificará al Cliente **sin demora injustificada y dentro de las 48 horas** desde que
   tome conocimiento de una vulneración que afecte datos personales tratados por su cuenta.
2. La notificación incluirá: naturaleza del incidente, categorías y volumen aproximado de datos y
   titulares afectados, consecuencias probables y medidas adoptadas o propuestas.
3. ZeroVisto **colaborará** con el Cliente en la notificación que éste deba hacer a la Agencia de
   Protección de Datos Personales y, cuando corresponda, a los titulares afectados. **La
   notificación a la autoridad es obligación del Cliente**, por ser el responsable.

## 10. Conservación y supresión

1. Los datos se conservan **mientras la cuenta esté activa**.
2. Al eliminar un negocio o una cuenta, se borran sus conversaciones, mensajes, horas agendadas,
   reservas y pedidos.
3. Terminado el Contrato, el Cliente dispone de **30 días** para exportar sus datos. Vencido ese
   plazo, ZeroVisto los **suprime**.
4. Los respaldos pueden conservar la información **hasta 30 días adicionales**, hasta que el
   respaldo rota.

## 11. Derechos de los titulares

1. El Cliente, como responsable, es quien debe atender los derechos de acceso, rectificación,
   supresión, oposición, portabilidad y bloqueo de sus clientes finales.
2. ZeroVisto pone a disposición del Cliente, **desde el propio panel**, las funciones para
   consultar, corregir, exportar y eliminar los datos de un contacto o de una conversación.
3. Si un titular ejerce sus derechos directamente ante ZeroVisto, ésta **lo derivará al Cliente**
   dentro de 5 días hábiles y le prestará asistencia razonable.

## 12. Auditoría

ZeroVisto pondrá a disposición del Cliente la información necesaria para acreditar el cumplimiento
de este Anexo. El Cliente podrá auditarlo **una vez al año**, con aviso previo de 30 días, en
horario hábil, sin interferir la operación y sujeto a confidencialidad. Si la auditoría excede una
revisión documental, su costo es de cargo del Cliente.

## 13. Normativa aplicable

Este Anexo se rige por la **Ley N° 19.628** sobre protección de la vida privada y, desde su entrada
en vigencia, por la **Ley N° 21.719**, que la reemplaza y crea la Agencia de Protección de Datos
Personales. Las Partes adecuarán este Anexo si la normativa o la Agencia lo exigen.

---

<br>

| | |
|---|---|
| <br><br>_________________________________<br>**[Nombre del representante]**<br>p. ZERO SYSTEM TECHNOLOGIES SpA<br>RUT 78.532.482-K<br>*Encargado del tratamiento* | <br><br>_________________________________<br>**[Nombre del representante]**<br>p. [Razón social del Cliente]<br>RUT [RUT]<br>*Responsable del tratamiento* |
