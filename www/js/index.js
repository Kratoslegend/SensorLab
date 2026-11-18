
document.addEventListener("deviceready", function () {

    // Navegación principal: cada sensor y el historial tienen su propia pestaña.
    const tabButtons = Array.from(document.querySelectorAll(".nav-tab"));
    const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
    function activateTab(panelId) {
        tabPanels.forEach(panel => panel.classList.toggle("active", panel.id === panelId));
        tabButtons.forEach(button => {
            const selected = button.dataset.tab === panelId;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-selected", selected ? "true" : "false");
        });
        if (panelId === "historyPanel" && typeof renderHistory === "function") renderHistory();

        window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
    tabButtons.forEach(button => button.addEventListener("click", () => activateTab(button.dataset.tab)));

    let activeSensor = null;
    let sensorInterval = null;
    let activeStartButton = null;
    let activeStopButton = null;
    let activeSessionId = null;
    let lastSavedAt = {};

    const HISTORY_KEY = "sensorlab_measurement_history_v1";
    const HISTORY_LIMIT = 1200;
    const HISTORY_INTERVAL_MS = 1000;
    let historyRecords = loadHistory();

    function loadHistory() {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed.slice(-HISTORY_LIMIT) : [];
        } catch (error) {
            console.error("No se pudo leer el historial:", error);
            return [];
        }
    }

    function persistHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(historyRecords));
            return true;
        } catch (error) {
            console.error("No se pudo guardar el historial:", error);
            return false;
        }
    }

    function recordHistory(sensor, label, value, unit, details, force) {
        const now = Date.now();
        if (!force && lastSavedAt[sensor] && now - lastSavedAt[sensor] < HISTORY_INTERVAL_MS) return;
        lastSavedAt[sensor] = now;
        historyRecords.push({
            id: now.toString(36) + Math.random().toString(36).slice(2, 7),
            sessionId: activeSessionId,
            sensor: sensor,
            label: label,
            value: value,
            unit: unit || "",
            details: details || "",
            timestamp: now
        });
        if (historyRecords.length > HISTORY_LIMIT) {
            historyRecords = historyRecords.slice(-HISTORY_LIMIT);
        }
        persistHistory();
        renderHistory();
    }

    function formatHistoryDate(timestamp) {
        return new Date(timestamp).toLocaleString("es-CL", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
    }

    function renderStatistics(records) {
        const numericRecords = records.filter(item => item.value !== null && item.value !== undefined && item.value !== "" && Number.isFinite(Number(item.value)));
        const countEl = document.getElementById("statsCount");
        const averageEl = document.getElementById("statsAverage");
        const maximumEl = document.getElementById("statsMaximum");
        const minimumEl = document.getElementById("statsMinimum");
        const breakdownEl = document.getElementById("statsSensorBreakdown");
        const contextEl = document.getElementById("statisticsContext");
        if (!countEl || !averageEl || !maximumEl || !minimumEl || !breakdownEl) return;
        const values = numericRecords.map(item => Number(item.value));
        const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        const maximum = values.length ? Math.max(...values) : null;
        const minimum = values.length ? Math.min(...values) : null;
        const formatNumber = value => value === null ? "--" : value.toLocaleString("es-CL", { maximumFractionDigits: 2 });
        countEl.textContent = numericRecords.length.toLocaleString("es-CL");
        averageEl.textContent = formatNumber(average);
        maximumEl.textContent = formatNumber(maximum);
        minimumEl.textContent = formatNumber(minimum);
        const names = { LIGHT: "Luminosidad", GPS: "GPS", CAMERA: "Cámara", MAGNETIC_FIELD: "Magnetómetro", ACCELEROMETER: "Acelerómetro", GYROSCOPE: "Giroscopio" };
        const order = ["LIGHT", "GPS", "CAMERA", "MAGNETIC_FIELD", "ACCELEROMETER", "GYROSCOPE"];
        const counts = {};
        records.forEach(item => { counts[item.sensor] = (counts[item.sensor] || 0) + 1; });
        const maxCount = Math.max(1, ...Object.values(counts));
        const rows = order.filter(sensor => counts[sensor]).map(sensor => {
            const count = counts[sensor];
            return '<div class="statistics-row"><div class="statistics-row-label"><span>' + escapeHistoryText(names[sensor] || sensor) + '</span><strong>' + count.toLocaleString("es-CL") + '</strong></div><div class="statistics-track"><span style="width:' + Math.round(count / maxCount * 100) + '%"></span></div></div>';
        });
        breakdownEl.innerHTML = rows.length ? rows.join("") : '<p class="statistics-empty">Todavía no hay datos para analizar.</p>';
        if (contextEl) contextEl.textContent = numericRecords.length ? "Promedio, mínimo y máximo calculados solo con registros numéricos. Los eventos de cámara y de inicio/cierre se cuentan en el desglose, pero no participan en esos cálculos." : "Aún no existen mediciones numéricas. Inicia un sensor para generar datos estadísticos.";
    }

    function renderHistory() {
        const list = document.getElementById("historyList");
        if (!list) return;
        const filter = document.getElementById("historyFilter");
        const selected = filter ? filter.value : "all";
        const filtered = selected === "all"
            ? historyRecords
            : historyRecords.filter(item => item.sensor === selected);
        renderStatistics(filtered);
        const recent = filtered.slice(-40).reverse();
        const total = document.getElementById("historyTotal");
        const sensors = document.getElementById("historySensors");
        const last = document.getElementById("historyLast");
        if (total) total.textContent = historyRecords.length.toLocaleString("es-CL");
        if (sensors) sensors.textContent = new Set(historyRecords.map(item => item.sensor)).size;
        if (last) last.textContent = historyRecords.length
            ? new Date(historyRecords[historyRecords.length - 1].timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
            : "--";

        if (!recent.length) {
            list.innerHTML = '<div class="history-empty">No hay registros para mostrar.</div>';
            return;
        }
        const names = {
            LIGHT: "Luminosidad", GPS: "Geolocalización GPS", CAMERA: "Cámara",
            MAGNETIC_FIELD: "Magnetómetro", ACCELEROMETER: "Acelerómetro", GYROSCOPE: "Giroscopio"
        };
        list.innerHTML = recent.map(item => {
            const valueText = item.value === null || item.value === undefined ? "Evento registrado" : item.value + " " + item.unit;
            const detail = item.details ? '<small>' + escapeHistoryText(item.details) + '</small>' : '';
            return '<article class="history-entry"><div class="history-entry-main"><strong>' +
                escapeHistoryText(names[item.sensor] || item.label) + '</strong><span>' + escapeHistoryText(valueText) +
                '</span>' + detail + '</div><time>' + formatHistoryDate(item.timestamp) + '</time></article>';
        }).join("");
    }

    function escapeHistoryText(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character]));
    }

    const historyFilter = document.getElementById("historyFilter");
    const refreshHistoryButton = document.getElementById("refreshHistoryButton");
    const clearHistoryButton = document.getElementById("clearHistoryButton");
    const exportHistoryButton = document.getElementById("exportHistoryButton");


    function csvEscape(value) {
        const text = value === null || value === undefined ? "" : String(value);
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function exportHistoryToCsv() {
        const selected = historyFilter ? historyFilter.value : "all";

        const records = selected === "all"
            ? historyRecords
            : historyRecords.filter(item => item.sensor === selected);

        if (!records.length) {
            window.alert("No hay registros para exportar con el filtro seleccionado.");
            return;
        }

        if (!window.cordova || !cordova.file) {
            window.alert("El sistema de archivos de SensorLab no está disponible.");
            return;
        }

        if (!cordova.plugins || !cordova.plugins.fileOpener2) {
            window.alert("El complemento para abrir archivos no está disponible.");
            return;
        }

        const headers = ["ID", "Sesión", "Sensor", "Nombre", "Valor", "Unidad", "Detalles", "Fecha y hora"];
        const rows = records.map(item => [
            item.id,
            item.sessionId,
            item.sensor,
            item.label,
            item.value,
            item.unit,
            item.details,
            new Date(item.timestamp).toLocaleString("es-CL")
        ]);

        const csv = "\uFEFF" + [headers, ...rows]
            .map(row => row.map(csvEscape).join(";"))
            .join("\r\n");

        const now = new Date();
        const stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            "_",
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0")
        ].join("");

        const fileName = "SensorLab_historial_" + stamp + ".csv";
        const directory = cordova.file.externalDataDirectory || cordova.file.dataDirectory;

        window.resolveLocalFileSystemURL(directory, function (directoryEntry) {
            directoryEntry.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
                fileEntry.createWriter(function (writer) {
                    writer.onerror = function (error) {
                        console.error("Error escribiendo CSV:", error);
                        window.alert("No se pudo guardar el archivo CSV.");
                    };

                    writer.onwriteend = function () {
                        cordova.plugins.fileOpener2.open(fileEntry.nativeURL, "text/csv", {
                            success: function () {
                                console.log("CSV abierto correctamente:", fileEntry.nativeURL);
                            },
                            error: function (error) {
                                console.error("Error abriendo CSV:", error);
                                window.alert("El archivo CSV fue guardado, pero no se pudo abrir automáticamente. Ubicación: " + fileEntry.nativeURL);
                            }
                        });
                    };

                    writer.write(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                }, function (error) {
                    console.error("Error creando escritor CSV:", error);
                    window.alert("No se pudo preparar el archivo CSV.");
                });
            }, function (error) {
                console.error("Error creando archivo CSV:", error);
                window.alert("No se pudo crear el archivo CSV.");
            });
        }, function (error) {
            console.error("Error accediendo al almacenamiento:", error);
            window.alert("No se pudo acceder al almacenamiento del dispositivo.");
        });
    }

    if (historyFilter) historyFilter.addEventListener("change", renderHistory);
    if (refreshHistoryButton) refreshHistoryButton.addEventListener("click", renderHistory);
    if (exportHistoryButton) exportHistoryButton.addEventListener("click", exportHistoryToCsv);
    if (clearHistoryButton) clearHistoryButton.addEventListener("click", function () {
        if (!historyRecords.length) return;
        if (window.confirm("¿Seguro que deseas borrar todo el historial guardado en este dispositivo? Esta acción no se puede deshacer.")) {
            historyRecords = [];
            lastSavedAt = {};
            persistHistory();
            renderHistory();
        }
    });
    renderHistory();

    function stopActiveSensor() {
        if (sensorInterval !== null) {
            clearInterval(sensorInterval);
            sensorInterval = null;
        }

        if (activeSensor !== null) {
            recordHistory(activeSensor, activeSensor, null, "", "Sesión de sensor finalizada", true);
            activeSessionId = null;
            try {
                sensors.disableSensor();
            } catch (error) {
                console.error("Error deteniendo sensor:", error);
            }
            activeSensor = null;
        }

        if (activeStartButton) activeStartButton.disabled = false;
        if (activeStopButton) activeStopButton.disabled = true;

        activeStartButton = null;
        activeStopButton = null;
    }

    function startSensor(type, statusElement, startBtn, stopBtn, callback) {
        stopActiveSensor();

        try {
            if (typeof sensors === "undefined") {
                throw new Error("Plugin de sensores no disponible");
            }

            activeSensor = type;
            activeSessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            lastSavedAt[type] = 0;
            recordHistory(type, type, null, "", "Sesión de sensor iniciada", true);
            activeStartButton = startBtn;
            activeStopButton = stopBtn;

            sensors.enableSensor(type);
            startBtn.disabled = true;
            stopBtn.disabled = false;
            statusElement.textContent = "Activando sensor...";

            sensorInterval = setInterval(function () {
                if (activeSensor !== type) return;

                sensors.getState(function (data) {
                    if (activeSensor !== type) return;

                    console.log(type + ":", data);

                    const values = Array.isArray(data)
                        ? data
                        : data && Array.isArray(data.values)
                            ? data.values
                            : null;

                    if (!values || values.length === 0) {
                        statusElement.textContent = "Esperando datos del sensor...";
                        return;
                    }

                    callback(values);
                    statusElement.textContent = "Sensor funcionando correctamente";

                }, function (error) {
                    console.error("Error " + type + ":", error);
                    statusElement.textContent = "Error al obtener datos del sensor";
                });
            }, 250);

        } catch (error) {
            console.error("Error iniciando " + type, error);
            stopActiveSensor();
            statusElement.textContent = "No se pudo iniciar el sensor";
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    function stopSensor(type, statusElement) {
        if (activeSensor === type) {
            stopActiveSensor();
            statusElement.textContent = "Sensor detenido";
        }
    }

    function numberOrZero(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function updateMeter(id, labelId, percentage, label, levelClass) {
        const meter = document.getElementById(id);
        const labelElement = document.getElementById(labelId);

        if (meter) {
            meter.style.width = Math.max(0, Math.min(100, percentage)) + "%";
            meter.classList.remove("level-low", "level-medium", "level-high");
            if (levelClass) meter.classList.add(levelClass);
        }

        if (labelElement) labelElement.textContent = label;
    }

    function updateCameraIndicator(state, label) {
        const dot = document.getElementById("cameraIndicator");
        const text = document.getElementById("cameraIndicatorLabel");

        if (dot) {
            dot.classList.remove("state-idle", "state-active", "state-success", "state-error");
            dot.classList.add(state);
        }
        if (text) text.textContent = label;
    }

    const chartBuffers = {
        light: [],
        magnetometer: [],
        accelerometer: [],
        gyroscope: []
    };

    function drawSensorChart(canvasId, samples, unit) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const width = Math.max(260, Math.floor(canvas.clientWidth || 300));
        const height = 150;
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);

        const context = canvas.getContext("2d");
        if (!context) return;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        const padding = { top: 12, right: 10, bottom: 24, left: 10 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        context.font = "10px sans-serif";
        context.fillStyle = "#7893af";
        context.strokeStyle = "rgba(105, 151, 190, 0.20)";
        context.lineWidth = 1;

        for (let line = 0; line <= 3; line++) {
            const y = padding.top + (plotHeight / 3) * line;
            context.beginPath();
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();
        }

        if (samples.length === 0) {
            context.fillStyle = "#7893af";
            context.textAlign = "center";
            context.fillText("Esperando mediciones...", width / 2, height / 2);
            return;
        }

        const minValue = Math.min(...samples);
        const maxValue = Math.max(...samples);
        const range = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.08, 1);
        const lower = minValue - range * 0.12;
        const upper = maxValue + range * 0.12;

        const yFor = value =>
            padding.top + ((upper - value) / (upper - lower)) * plotHeight;

        context.fillStyle = "#9bb4ce";
        context.textAlign = "left";
        context.fillText(maxValue.toFixed(1) + " " + unit, padding.left, 10);
        context.textAlign = "right";
        context.fillText(minValue.toFixed(1) + " " + unit, width - padding.right, height - 5);

        if (samples.length === 1) {
            const x = padding.left + plotWidth / 2;
            const y = yFor(samples[0]);
            context.fillStyle = "#35d9f5";
            context.beginPath();
            context.arc(x, y, 4, 0, Math.PI * 2);
            context.fill();
            return;
        }

        context.strokeStyle = "#35d9f5";
        context.lineWidth = 2.5;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.beginPath();

        samples.forEach((value, index) => {
            const x = padding.left + (index / (samples.length - 1)) * plotWidth;
            const y = yFor(value);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        });

        context.stroke();

        const lastX = width - padding.right;
        const lastY = yFor(samples[samples.length - 1]);
        context.fillStyle = "#a4efff";
        context.beginPath();
        context.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
        context.fill();
    }

    function addChartSample(buffer, value, canvasId, unit) {
        buffer.push(value);
        if (buffer.length > 30) buffer.shift();
        drawSensorChart(canvasId, buffer, unit);
    }

    function resetChart(buffer, canvasId, unit) {
        buffer.length = 0;
        drawSensorChart(canvasId, buffer, unit);
    }

    window.addEventListener("resize", function () {
        drawSensorChart("lightChart", chartBuffers.light, "lx");
        drawSensorChart("magChart", chartBuffers.magnetometer, "µT");
        drawSensorChart("accelChart", chartBuffers.accelerometer, "m/s²");
        drawSensorChart("gyroChart", chartBuffers.gyroscope, "°/s");
    });

    drawSensorChart("lightChart", chartBuffers.light, "lx");
    drawSensorChart("magChart", chartBuffers.magnetometer, "µT");
    drawSensorChart("accelChart", chartBuffers.accelerometer, "m/s²");
    drawSensorChart("gyroChart", chartBuffers.gyroscope, "°/s");

    const lightValue = document.getElementById("lightValue");
    const status = document.getElementById("status");
    const startButton = document.getElementById("startButton");
    const stopButton = document.getElementById("stopButton");
    const lightInterpretation = document.getElementById("lightInterpretation");

    function interpretLight(lux) {
        if (lux < 10) {
            return "Entorno muy oscuro. Hay poca luz ambiental y puede ser insuficiente para leer o realizar tareas de detalle.";
        } else if (lux < 100) {
            return "Iluminación baja. Es un ambiente tenue; para leer o trabajar conviene contar con una fuente de luz adicional.";
        } else if (lux < 300) {
            return "Iluminación moderada. Puede ser suficiente para algunas actividades, aunque las tareas de detalle podrían requerir más luz.";
        } else if (lux < 1000) {
            return "Buena iluminación ambiental para muchas actividades cotidianas. El nivel adecuado depende de la tarea que realices.";
        }
        return "Iluminación intensa. El sensor recibe mucha luz; evita apuntarlo directamente a una fuente intensa si quieres medir el entorno.";
    }

    startButton.addEventListener("click", function () {
        startSensor("LIGHT", status, startButton, stopButton, function (values) {
            const lux = Math.max(0, numberOrZero(values[0]));
            lightValue.textContent = lux.toFixed(2);
            lightInterpretation.textContent = interpretLight(lux);

            const lightPercent = Math.min(100, (lux / 1000) * 100);
            let lightLevel = "Baja";
            let lightClass = "level-low";
            if (lux >= 300 && lux < 1000) {
                lightLevel = "Buena";
                lightClass = "level-medium";
            } else if (lux >= 1000) {
                lightLevel = "Intensa";
                lightClass = "level-high";
            }
            updateMeter("lightMeter", "lightLevelLabel", lightPercent, lightLevel, lightClass);
            addChartSample(chartBuffers.light, lux, "lightChart", "lx");
            recordHistory("LIGHT", "Luminosidad", lux.toFixed(2), "lx", "Nivel de luz ambiental");
        });
    });

    stopButton.addEventListener("click", function () {
        stopSensor("LIGHT", status);
        lightValue.textContent = "--";
        lightInterpretation.textContent = "Sensor detenido. Inícialo nuevamente para obtener otra lectura.";
        updateMeter("lightMeter", "lightLevelLabel", 0, "Sin lectura", null);
        resetChart(chartBuffers.light, "lightChart", "lx");
    });

    const latitude = document.getElementById("latitude");
    const longitude = document.getElementById("longitude");
    const accuracy = document.getElementById("accuracy");
    const gpsStatus = document.getElementById("gpsStatus");
    const gpsButton = document.getElementById("gpsButton");
    const gpsInterpretation = document.getElementById("gpsInterpretation");

    function interpretGpsAccuracy(meters) {
        if (meters <= 5) {
            return "Precisión estimada muy buena. El margen informado por el sistema es de aproximadamente " + meters.toFixed(1) + " metros.";
        } else if (meters <= 15) {
            return "Precisión estimada buena. La posición puede tener un margen aproximado de " + meters.toFixed(1) + " metros.";
        } else if (meters <= 50) {
            return "Precisión estimada moderada. La ubicación es orientativa y puede variar dentro de un margen aproximado de " + meters.toFixed(1) + " metros.";
        }
        return "Precisión estimada baja. El margen informado es de " + meters.toFixed(1) + " metros; intenta medir en un espacio abierto.";
    }

    gpsButton.addEventListener("click", function () {
        if (!navigator.geolocation) {
            gpsStatus.textContent = "Geolocalización no disponible";
            gpsInterpretation.textContent = "Este dispositivo o entorno no ofrece el servicio de geolocalización.";
            return;
        }

        gpsButton.disabled = true;
        gpsStatus.textContent = "Obteniendo ubicación...";

        navigator.geolocation.getCurrentPosition(function (position) {
            const coords = position.coords;
            const meters = Number(coords.accuracy);

            latitude.textContent = coords.latitude.toFixed(6);
            longitude.textContent = coords.longitude.toFixed(6);
            accuracy.textContent = meters.toFixed(2) + " metros";
            gpsStatus.textContent = "Ubicación obtenida correctamente";
            gpsInterpretation.textContent = interpretGpsAccuracy(meters);
            recordHistory("GPS", "Geolocalización GPS", meters.toFixed(2), "m de precisión", "Lat: " + coords.latitude.toFixed(6) + ", Lon: " + coords.longitude.toFixed(6), true);

            const gpsScore = Math.max(0, Math.min(100, 100 - (meters / 50) * 100));
            let gpsLabel = "Baja";
            let gpsClass = "level-low";
            if (meters <= 15) {
                gpsLabel = "Buena";
                gpsClass = "level-medium";
            }
            if (meters <= 5) {
                gpsLabel = "Muy buena";
                gpsClass = "level-high";
            }
            updateMeter("gpsMeter", "gpsQualityLabel", gpsScore, gpsLabel, gpsClass);

            gpsButton.disabled = false;
            console.log("Ubicación GPS:", position);

        }, function (error) {
            const errors = {
                1: "Permiso de ubicación denegado",
                2: "Ubicación no disponible",
                3: "Tiempo de espera agotado"
            };

            gpsStatus.textContent = errors[error.code] || "Error al obtener ubicación";
            gpsInterpretation.textContent = "No fue posible interpretar la precisión porque no se recibió una ubicación.";
            updateMeter("gpsMeter", "gpsQualityLabel", 0, "Sin lectura", null);
            gpsButton.disabled = false;
            console.error("Error GPS:", error);

        }, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        });
    });

    const cameraButton = document.getElementById("cameraButton");
    const cameraStatus = document.getElementById("cameraStatus");
    const cameraInterpretation = document.getElementById("cameraInterpretation");
    const photoPreview = document.getElementById("photoPreview");

    cameraButton.addEventListener("click", function () {
        if (!navigator.camera) {
            cameraStatus.textContent = "La cámara no está disponible";
            cameraInterpretation.textContent = "No se encontró el plugin de cámara o no está disponible en este dispositivo.";
            updateCameraIndicator("state-error", "Cámara no disponible");
            return;
        }

        cameraButton.disabled = true;
        cameraStatus.textContent = "Abriendo cámara...";
        updateCameraIndicator("state-active", "Cámara en uso");

        navigator.camera.getPicture(function (imageData) {
            if (!imageData) {
                cameraStatus.textContent = "No se recibió una fotografía";
                cameraInterpretation.textContent = "La captura no devolvió datos de imagen.";
                updateCameraIndicator("state-error", "No se recibió imagen");
                cameraButton.disabled = false;
                return;
            }

            photoPreview.onload = function () {
                photoPreview.style.display = "block";
                cameraStatus.textContent = "Fotografía capturada correctamente";
                cameraInterpretation.textContent = "La fotografía se recibió y se pudo visualizar en la aplicación. También se solicitó guardarla en el álbum del dispositivo.";
                updateCameraIndicator("state-success", "Captura correcta");
                recordHistory("CAMERA", "Cámara", null, "", "Fotografía capturada correctamente; imagen conservada fuera del historial", true);
                cameraButton.disabled = false;
            };

            photoPreview.onerror = function () {
                cameraStatus.textContent = "No se pudo visualizar la fotografía";
                cameraInterpretation.textContent = "Se recibieron datos de imagen, pero no fue posible mostrarlos en la aplicación.";
                updateCameraIndicator("state-error", "Error al mostrar imagen");
                cameraButton.disabled = false;
            };

            photoPreview.src = imageData.startsWith("data:")
                ? imageData
                : "data:image/jpeg;base64," + imageData;

            console.log("Fotografía capturada");

        }, function (error) {
            cameraStatus.textContent = "No se pudo capturar la fotografía";
            cameraInterpretation.textContent = "La captura fue cancelada o se produjo un error. Revisa los permisos de cámara.";
            updateCameraIndicator("state-error", "Captura cancelada o fallida");
            cameraButton.disabled = false;
            console.error("Error de cámara:", error);

        }, {
            quality: 80,
            destinationType: Camera.DestinationType.DATA_URL,
            sourceType: Camera.PictureSourceType.CAMERA,
            encodingType: Camera.EncodingType.JPEG,
            mediaType: Camera.MediaType.PICTURE,
            correctOrientation: true,
            saveToPhotoAlbum: true
        });
    });


    const magX = document.getElementById("magX");
    const magY = document.getElementById("magY");
    const magZ = document.getElementById("magZ");
    const magTotal = document.getElementById("magTotal");
    const magStatus = document.getElementById("magStatus");
    const magInterpretation = document.getElementById("magInterpretation");
    const startMagButton = document.getElementById("startMagButton");
    const stopMagButton = document.getElementById("stopMagButton");

    let previousMagTotal = null;

    startMagButton.addEventListener("click", function () {
        previousMagTotal = null;

        startSensor("MAGNETIC_FIELD", magStatus, startMagButton, stopMagButton, function (values) {
            const x = numberOrZero(values[0]);
            const y = numberOrZero(values[1]);
            const z = numberOrZero(values[2]);
            const total = Math.sqrt(x * x + y * y + z * z);

            magX.textContent = x.toFixed(2);
            magY.textContent = y.toFixed(2);
            magZ.textContent = z.toFixed(2);
            magTotal.textContent = total.toFixed(2);

            if (previousMagTotal === null) {
                magInterpretation.textContent = "Campo magnético total de " + total.toFixed(2) +
                    " µT. Mantén el teléfono estable para observar cómo cambia la medición.";
            } else {
                const difference = Math.abs(total - previousMagTotal);

                if (difference < 1) {
                    magInterpretation.textContent = "La intensidad se mantiene relativamente estable. Valor actual: " + total.toFixed(2) + " µT.";
                } else {
                    magInterpretation.textContent = "Se detectó una variación de " + difference.toFixed(2) +
                        " µT entre lecturas. Puede deberse al movimiento del teléfono o a cambios en el entorno.";
                }
            }

            const magChangePercent = previousMagTotal === null
                ? 0
                : Math.min(100, (Math.abs(total - previousMagTotal) / Math.max(previousMagTotal, 1)) * 100 * 3);

            let magLabel = "Estable";
            let magClass = "level-high";
            if (magChangePercent >= 15) {
                magLabel = "Variable";
                magClass = "level-low";
            } else if (magChangePercent >= 5) {
                magLabel = "Cambio leve";
                magClass = "level-medium";
            }
            updateMeter("magMeter", "magStabilityLabel", magChangePercent, magLabel, magClass);
            addChartSample(chartBuffers.magnetometer, total, "magChart", "µT");
            recordHistory("MAGNETIC_FIELD", "Magnetómetro", total.toFixed(2), "µT", "X: " + x.toFixed(2) + ", Y: " + y.toFixed(2) + ", Z: " + z.toFixed(2));

            previousMagTotal = total;
        });
    });

    stopMagButton.addEventListener("click", function () {
        stopSensor("MAGNETIC_FIELD", magStatus);
        magX.textContent = "--";
        magY.textContent = "--";
        magZ.textContent = "--";
        magTotal.textContent = "--";
        previousMagTotal = null;
        magInterpretation.textContent = "Sensor detenido. El magnetómetro mide campos magnéticos; no identifica por sí solo todos los metales.";
        updateMeter("magMeter", "magStabilityLabel", 0, "Sin lectura", null);
        resetChart(chartBuffers.magnetometer, "magChart", "µT");
    });

    const accelX = document.getElementById("accelX");
    const accelY = document.getElementById("accelY");
    const accelZ = document.getElementById("accelZ");
    const accelTotal = document.getElementById("accelTotal");
    const accelerometerStatus = document.getElementById("accelerometerStatus");
    const accelerometerInterpretation = document.getElementById("accelerometerInterpretation");
    const startAccelerometerButton = document.getElementById("startAccelerometerButton");
    const stopAccelerometerButton = document.getElementById("stopAccelerometerButton");

    let previousAccelMagnitude = null;

    startAccelerometerButton.addEventListener("click", function () {
        previousAccelMagnitude = null;

        startSensor("ACCELEROMETER", accelerometerStatus,
            startAccelerometerButton, stopAccelerometerButton, function (values) {

                const x = numberOrZero(values[0]);
                const y = numberOrZero(values[1]);
                const z = numberOrZero(values[2]);
                const magnitude = Math.sqrt(x * x + y * y + z * z);

                accelX.textContent = x.toFixed(3);
                accelY.textContent = y.toFixed(3);
                accelZ.textContent = z.toFixed(3);
                accelTotal.textContent = magnitude.toFixed(3);

                if (previousAccelMagnitude === null) {
                    accelerometerInterpretation.textContent = "Magnitud total: " + magnitude.toFixed(2) +
                        " m/s². Un teléfono quieto suele registrar cerca de 9,81 m/s² por efecto de la gravedad.";
                } else {
                    const variation = Math.abs(magnitude - previousAccelMagnitude);

                    if (variation < 0.35) {
                        accelerometerInterpretation.textContent = "Lecturas relativamente estables. No se aprecia un cambio importante entre las últimas muestras.";
                    } else if (variation < 1.5) {
                        accelerometerInterpretation.textContent = "Se observa una variación moderada en la aceleración. El dispositivo podría estar cambiando de posición o moviéndose suavemente.";
                    } else {
                        accelerometerInterpretation.textContent = "Se observa una variación marcada en la aceleración. El dispositivo está experimentando un movimiento o cambio brusco.";
                    }
                }

                const movementChange = previousAccelMagnitude === null
                    ? 0
                    : Math.abs(magnitude - previousAccelMagnitude);

                let activityLabel = "Estable";
                let activityClass = "level-high";
                let activityPercent = Math.min(100, movementChange * 20);

                if (movementChange >= 1.5) {
                    activityLabel = "Movimiento marcado";
                    activityClass = "level-low";
                } else if (movementChange >= 0.35) {
                    activityLabel = "Movimiento leve";
                    activityClass = "level-medium";
                }

                updateMeter("accelMeter", "accelActivityLabel", activityPercent, activityLabel, activityClass);
                addChartSample(chartBuffers.accelerometer, magnitude, "accelChart", "m/s²");
                recordHistory("ACCELEROMETER", "Acelerómetro", magnitude.toFixed(3), "m/s²", "X: " + x.toFixed(2) + ", Y: " + y.toFixed(2) + ", Z: " + z.toFixed(2));
                previousAccelMagnitude = magnitude;
            });
    });

    stopAccelerometerButton.addEventListener("click", function () {
        stopSensor("ACCELEROMETER", accelerometerStatus);
        accelX.textContent = "--";
        accelY.textContent = "--";
        accelZ.textContent = "--";
        accelTotal.textContent = "--";
        previousAccelMagnitude = null;
        accelerometerInterpretation.textContent = "Sensor detenido. Recuerda que el acelerómetro también registra la gravedad.";
        updateMeter("accelMeter", "accelActivityLabel", 0, "Sin lectura", null);
        resetChart(chartBuffers.accelerometer, "accelChart", "m/s²");
    });

    const gyroX = document.getElementById("gyroX");
    const gyroY = document.getElementById("gyroY");
    const gyroZ = document.getElementById("gyroZ");
    const gyroTotal = document.getElementById("gyroTotal");
    const gyroscopeStatus = document.getElementById("gyroscopeStatus");
    const gyroscopeInterpretation = document.getElementById("gyroscopeInterpretation");
    const startGyroscopeButton = document.getElementById("startGyroscopeButton");
    const stopGyroscopeButton = document.getElementById("stopGyroscopeButton");

    const RAD_TO_DEG = 180 / Math.PI;

    startGyroscopeButton.addEventListener("click", function () {
        startSensor("GYROSCOPE", gyroscopeStatus,
            startGyroscopeButton, stopGyroscopeButton, function (values) {

                const x = numberOrZero(values[0]);
                const y = numberOrZero(values[1]);
                const z = numberOrZero(values[2]);

                const angularSpeedRad = Math.sqrt(x * x + y * y + z * z);
                const angularSpeedDeg = angularSpeedRad * RAD_TO_DEG;

                gyroX.textContent = x.toFixed(4);
                gyroY.textContent = y.toFixed(4);
                gyroZ.textContent = z.toFixed(4);
                gyroTotal.textContent = angularSpeedDeg.toFixed(2);

                if (angularSpeedDeg < 5) {
                    gyroscopeInterpretation.textContent = "Rotación muy baja (" + angularSpeedDeg.toFixed(2) +
                        " °/s). El dispositivo presenta poco giro en este instante.";
                } else if (angularSpeedDeg < 45) {
                    gyroscopeInterpretation.textContent = "Rotación suave (" + angularSpeedDeg.toFixed(2) +
                        " °/s). El dispositivo está girando lentamente.";
                } else if (angularSpeedDeg < 180) {
                    gyroscopeInterpretation.textContent = "Rotación moderada (" + angularSpeedDeg.toFixed(2) +
                        " °/s). Se observa un giro perceptible del dispositivo.";
                } else {
                    gyroscopeInterpretation.textContent = "Rotación rápida (" + angularSpeedDeg.toFixed(2) +
                        " °/s). El dispositivo está girando a alta velocidad.";
                }

                let gyroLabel = "Muy lenta";
                let gyroClass = "level-high";
                if (angularSpeedDeg >= 5 && angularSpeedDeg < 45) {
                    gyroLabel = "Suave";
                    gyroClass = "level-medium";
                } else if (angularSpeedDeg >= 45 && angularSpeedDeg < 180) {
                    gyroLabel = "Moderada";
                    gyroClass = "level-medium";
                } else if (angularSpeedDeg >= 180) {
                    gyroLabel = "Rápida";
                    gyroClass = "level-low";
                }
                updateMeter("gyroMeter", "gyroSpeedLabel",
                    Math.min(100, (angularSpeedDeg / 360) * 100), gyroLabel, gyroClass);
                addChartSample(chartBuffers.gyroscope, angularSpeedDeg, "gyroChart", "°/s");
                recordHistory("GYROSCOPE", "Giroscopio", angularSpeedDeg.toFixed(2), "°/s", "X: " + x.toFixed(3) + ", Y: " + y.toFixed(3) + ", Z: " + z.toFixed(3) + " rad/s");
            });
    });

    stopGyroscopeButton.addEventListener("click", function () {
        stopSensor("GYROSCOPE", gyroscopeStatus);
        gyroX.textContent = "--";
        gyroY.textContent = "--";
        gyroZ.textContent = "--";
        gyroTotal.textContent = "--";
        gyroscopeInterpretation.textContent = "Sensor detenido. El giroscopio mide velocidad de rotación, no el ángulo absoluto del teléfono.";
        updateMeter("gyroMeter", "gyroSpeedLabel", 0, "Sin lectura", null);
        resetChart(chartBuffers.gyroscope, "gyroChart", "°/s");
    });

    console.log("SensorLab iniciado correctamente");
});