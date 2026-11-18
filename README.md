# SensorLab

Aplicación móvil Android desarrollada con Apache Cordova para visualizar y registrar mediciones de sensores disponibles en el dispositivo.

## Funcionalidades

- **Luminosidad:** lectura del sensor de luz.
- **GPS:** obtención de ubicación mediante geolocalización.
- **Cámara:** captura de imágenes desde el dispositivo.
- **Magnetómetro:** lectura del campo magnético.
- **Acelerómetro:** medición de aceleración.
- **Giroscopio:** medición de velocidad angular.
- Interpretación de mediciones e indicadores visuales.
- Gráficos en tiempo real para sensores de lectura continua.
- Historial local persistente de mediciones.
- Filtros por sensor.
- Exportación del historial a CSV.
- Estadísticas: cantidad de registros, promedio, mínimo, máximo y distribución por sensor.
- Interfaz oscura de estilo tecnológico y navegación por pestañas.

## Tecnologías

- Apache Cordova 13
- Cordova Android 15.1.0
- HTML5, CSS3 y JavaScript
- Java 17 para el entorno Android
- Almacenamiento local mediante `localStorage`
- Plugins Cordova para sensores, geolocalización, cámara y archivos.

## Plugins utilizados

Instalar desde la raíz del proyecto:

```powershell
cordova.cmd plugin add https://github.com/fabiorogeriosj/cordova-plugin-sensors.git
cordova.cmd plugin add cordova-plugin-geolocation
cordova.cmd plugin add cordova-plugin-camera
cordova.cmd plugin add cordova-plugin-file
cordova.cmd plugin add cordova-plugin-file-opener2
```

## Requisitos de desarrollo

- Node.js y npm
- Apache Cordova CLI
- Java JDK 17
- Android Studio / Android SDK
- Android SDK Platform y Build Tools compatibles con la plataforma instalada

## Preparar el proyecto

Este paquete contiene el código fuente web de SensorLab (`www`) y la configuración base de Cordova. No incluye `platforms/`, `node_modules/` ni una APK compilada.

1. Crear o abrir un proyecto Cordova.
2. Copiar la carpeta `www` de este paquete a la raíz del proyecto.
3. Verificar los plugins indicados e instalarlos si faltan.
4. Agregar Android y compilar:

```powershell
cordova.cmd platform add android@15.1.0
cordova.cmd build android
```

## Instalar en un dispositivo conectado

```powershell
adb install -r platforms\android\app\build\outputs\apk\debug\app-debug.apk
```

La APK de depuración se genera en:

`platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## Notas de funcionamiento

- El proyecto se probó en un Xiaomi POCO X7 Pro con Android 16, según las pruebas realizadas durante el desarrollo.
- La aplicación utiliza un sensor físico activo a la vez para respetar el comportamiento del plugin de sensores.
- Los datos del historial se guardan localmente en el dispositivo. Desinstalar la aplicación o borrar sus datos puede eliminar ese almacenamiento.
- La exportación CSV requiere los plugins `cordova-plugin-file` y `cordova-plugin-file-opener2`.
- Los resultados de los sensores dependen del hardware disponible y de los permisos concedidos por Android.

## Estructura

```text
SensorLab/
├── config.xml
├── package.json
├── README.md
└── www/
    ├── index.html
    ├── css/
    │   └── index.css
    └── js/
        └── index.js
```

## Estado

Desarrollo funcional organizado en siete etapas: interpretación, indicadores, gráficos, historial, exportación CSV, estadísticas y pruebas finales realizadas por el usuario.
