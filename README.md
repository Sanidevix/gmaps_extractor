# gmaps_extractor
Busca establecimientos en Google Maps y extrae información relevante (principalmente teléfonos) para organizar tus datos.

-------------------------------------------------------------------------------------------------------------------------------------

🚀 Características y Mejoras
Esta extensión de Chrome ha sido diseñada para una extracción de datos más precisa y eficiente de Google Maps.

1. Extracción de Datos Mejorada
Consulta Original Incluida: Cada registro ahora incluye la consulta de búsqueda original, lo que facilita el seguimiento y la organización de tus extracciones.
Múltiples Resultados: La extensión puede identificar y extraer información básica de hasta 5 resultados mostrados en la página de búsqueda inicial de Google Maps.
Detalles del Primer Resultado: Si se muestra una lista de resultados, la extensión hace clic automáticamente en el primer establecimiento para capturar su información detallada. Si la búsqueda dirige directamente a un establecimiento, se extraen todos los datos de esa página.
Campos Completos: Todos los registros exportados incluyen los siguientes campos:
Consulta Original: El texto exacto que se utilizó para la búsqueda.
Nombre del Establecimiento: El nombre oficial del lugar.
Dirección: La dirección completa del establecimiento.
Teléfono: El número de teléfono de contacto.
Correo Electrónico: La dirección de correo electrónico (si está disponible).

3. Precisión Mejorada del Scraping
Algoritmos Robustos: Se emplean múltiples métodos para una detección más fiable de los elementos en la página:
Búsqueda por palabras clave: Se buscan términos clave tanto en español como en inglés.
Búsqueda por patrones de texto: Uso de expresiones regulares para identificar datos específicos.
Selectores CSS Variados: Se utilizan diferentes selectores CSS para adaptarse a la estructura dinámica de Google Maps.
Esperas Inteligentes: La extensión incorpora esperas adaptativas para asegurar que la página web cargue completamente todos sus elementos dinámicos antes de intentar extraer la información.
Manejo de Errores Básico: Se ha implementado una gestión de errores mejorada para intentar devolver siempre alguna información, incluso si ocurren problemas durante la extracción.

4. Estructura del CSV Actualizada
El archivo CSV generado por la extensión ahora presenta las siguientes columnas de forma clara:

Consulta Original
Nombre
Dirección
Teléfono
Correo Electrónico

🛠️ Estructura del Proyecto
Para que la extensión funcione correctamente, asegúrate de que la estructura de tu proyecto sea la siguiente:

maps-data-collector/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content.js
├── styles.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    └── hack.jpg
Paso 1: Crear la Estructura de Directorios
Crea una nueva carpeta principal llamada maps-data-collector.
Dentro de maps-data-collector, crea una subcarpeta llamada icons.
Paso 2: Añadir los Archivos
Copia los siguientes archivos directamente en la raíz de maps-data-collector:
manifest.json
popup.html
popup.js
background.js
content.js
styles.css
Dentro de la carpeta icons, coloca las siguientes imágenes:
icon16.png (16x16 píxeles)
icon48.png (48x48 píxeles)
icon128.png (128x128 píxeles)
hack.jpg (para el logo)

⚙️ Funcionamiento Actualizado
El flujo de trabajo de la extensión es el siguiente:

El usuario introduce las consultas de búsqueda en el área de texto (presumiblemente de color morado en la interfaz de usuario).
La extensión procesa cada consulta de forma secuencial, abriendo nuevas pestañas en Google Maps para cada búsqueda.
Si Google Maps muestra una lista de resultados:
La extensión captura los datos básicos de hasta 5 de estos resultados.
Posteriormente, hace clic automáticamente en el primer resultado de la lista para obtener información más detallada de ese establecimiento.
Finalmente, combina la información básica y detallada del primer resultado.
Si Google Maps muestra directamente un establecimiento (sin lista de resultados):
La extensión extrae todos los datos relevantes directamente de la página de detalle del establecimiento.
Una vez extraídos, los datos se almacenan internamente y, cuando el proceso finaliza (o se indica), se descargan como un archivo CSV.

⚠️ Limitaciones y Consideraciones
Es importante tener en cuenta las siguientes limitaciones y recomendaciones:

Tiempos de Extracción Variables: Google Maps es una aplicación dinámica y carga sus elementos de forma asíncrona. Esto puede causar variaciones en los tiempos necesarios para extraer la información.
Detección de Correos Electrónicos: La extracción de correos electrónicos es particularmente difícil, ya que Google Maps rara vez los muestra directamente en la página del establecimiento. Normalmente, los correos se encuentran incrustados en los sitios web de los establecimientos, lo cual esta extensión no explora.
Bloqueos de Google: El uso intensivo y continuado de herramientas de scraping puede ser detectado por Google, lo que podría resultar en restricciones temporales o bloqueos de IP.
Posibles Mejoras
Detección de Elementos: El método actual de scraping es efectivo para muchos casos, pero la complejidad y los cambios frecuentes en la estructura de Google Maps podrían requerir métodos más avanzados para una mayor fiabilidad.
Manejo de Errores Avanzado: Aunque se ha implementado un manejo básico, se podrían añadir rutinas de error más sofisticadas para escenarios específicos (ej. páginas de error, cambios inesperados en el DOM).
Mitigación de Bloqueos: Para un uso más robusto y a gran escala, se recomienda:
Implementar retrasos aleatorios entre las búsquedas para simular un comportamiento más humano.
Limitar el número de búsquedas por sesión o por un período de tiempo.
Considerar el uso de la API oficial de Google Maps Platform para proyectos serios y de gran volumen, ya que ofrece una solución más estable y conforme a los términos de servicio, aunque con costos asociados.

🚀 Instalación y Prueba (Resumen)
Las instrucciones para instalar y probar la extensión son las mismas que se mencionaron anteriormente:

Crear la estructura de directorios (maps-data-collector con su subcarpeta icons).
Copiar todos los archivos (.json, .html, .js, .css) en la raíz y los iconos en la carpeta icons.
Cargar la extensión en Chrome:
Abre Chrome y navega a chrome://extensions/.
Activa el "Modo desarrollador" (esquina superior derecha).
Haz clic en "Cargar descomprimida".
Selecciona la carpeta maps-data-collector que creaste.
