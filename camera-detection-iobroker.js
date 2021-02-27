// Bildererkennung-Script, Version 0.1
// Es gibt 4 Stellen wo was getan werden muss, Siehe Handlungsbedarf 1-4

// ####################################################################################################
// # HANDLUNGSBEDARF 1 von 4: NPM-Module installieren                                                 #
// ####################################################################################################

/**
 * Installation aller benötigten NPM-Module:
 * ------------------------------------------------------------------------------------------------------
 * Einfach unter /opt/iobroker/ mit Proxmox-Konsole, Putty,... nacheinander folgende Befehle eingeben
  * ------------------------------------------------------------------------------------------------------
 * npm install image-size --save
 * npm install --save string-pixel-width
 * npm init -y
 * npm install @tensorflow/tfjs-node
 * npm install @tensorflow-models/coco-ssd
 * npm install gm
 * apt-get update
 * apt-get install -y graphicsmagick
  * ------------------------------------------------------------------------------------------------------
 */
const sizeOf        = require('image-size');
const pixelWidth    = require('string-pixel-width');
const tf            = require("@tensorflow/tfjs-node");
const cocoSsd       = require("@tensorflow-models/coco-ssd");
const gm            = require('gm');
const disk_fs       = require('fs');      

// ####################################################################################################
// # HANDLUNGSBEDARF 2 von 4: KAMERA-KONFIGURIEREN                                                    #
// ####################################################################################################

/**
 * Erklärungen der Parameter:
 * ----------------------------------------------------------------------------------------------------------------
 * Generell: 
 * - Hier wird die relevante IP-Kamera dieses Scriptes konfiguriert. Möchte man Bilderkennungen von mehreren Kameras, dann bitte pro Kamera 1 Script anlegen.
 * - Vorraussetzung: Es muss möglich sein ein Bild von der Kamera abgreifen zu können
 * 
 * [01] URL der IP-Camera mit User und Password. Am besten keine UMLAUTE nehmen!!
 * [02] Name der Kamera, z.B. "Haustüre"
 *
 *      Alarm über Telegramm:
 *      ---------------------------------------------------------
 * [03] Alarm über Telegram erwünscht, falls nein hier false eingeben. In dem Fall ist es dann egal was bei [4] - [7] steht!
 * [04] Instanz von Telegram, meist "telegram.0". Über diese Instanz wird die Telegram-Nachricht bei Alarm versendet
 * [05] Innerhalb dieser Zeitspanne (Angabe in Sekunden) wird ein Alarm nur 1x ausgelöst und zwar am ENDE dieses Intervalls mit dem besten Bild in dieser Zeitspanne!
 * [06] Welche Objekte (Personen, Autos, Handy,...) sollen erkannt werden. 
 *      Mögliche Objekte sind person, car,....Alle möglichen Typen sind hier aufgelistet: https://github.com/pjreddie/darknet/blob/master/data/coco.names
 *      Möchte man pro Kamera mehere Objekte unterstützen, dann bitte ein neues Script (für die gleiche Kamera, mit anderem Objekt) anlegen
 * [07] Die Mindesterkennungsrate (0: Alles wird erkannt, 100: Nur eine perfekte Erkennung zählt als Alarm). 75-80 ist ein guter Wert!
 *
 *      Alarm über Alexa: (oder Google Home, oder irgendwas...)
 *      ---------------------------------------------------------
 * [08] Alarm über Alexa erwünscht, falls nein hier false eingeben. In dem Fall ist es dann egal was bei [09] - [11] steht!
 * [09] Alarm wird sofort ausgeführt. Nach einer Alexa-Durchsage wird so lange gewartet bis wieder eine Durchsage erfolgen kann
 * [10] Siehe [06]
 * [11] Siehe [07]
 * 
 *      Alarm über File: ("Alarm"-Bild wird auf Festplatte scgeschrieben (Webserver, Einfach nur auf die Festplatte schreiben, FTP-Server?!....)
 *      ---------------------------------------------------------
 * [12] Alarm über File erwünscht, falls nein hier false eingeben. In dem Fall ist es dann egal was bei [13] - [16] steht!
 * [13] Basisverzeichnis wo das Bild abgelegt wird. Bitte auf das abschließende "/" achten. D.h. String muss mit "/" enden. Achtung!!! Der ioBroker User muss darauf Schreibberechtigung haben!!
 * [14] Innerhalb dieser Zeitspanne (Angabe in Sekunden) wird ein Alarm nur 1x ausgelöst und zwar am ENDE dieses Intervalls mit dem besten Bild in dieser Zeitspanne!
 * [15] Siehe [06]
 * [16] Siehe [07]
 *
 *      Schreiben in der Datenpunkt
 *      ---------------------------------------------------------
 * [17] Schreiben der Erkennung in einen Datenpunkt, falls nein hier false eingeben. In dem Fall ist es dann egal was bei [18] steht!
 * [18] Basisverzeichnis wo das Bild abgelegt wird. Bitte auf das abschließende "/" achten. D.h. String muss mit "/" enden. Achtung!!! Der ioBroker User muss darauf Schreibberechtigung haben!!
 */
var camera = new Camera(
    "http://192.168.178.47/tmpfs/snap.jpg?usr=admin&pwd=37947343",      // [01] URL der Kamera           (Erklärung, siehe oben)
    "Haustuere",                                                        // [02] Name der Kamera          (Erklärung, siehe oben)
    new TelegramAlarm(                                                  
        true,                                                           // [03] Telegram aktiv           (Erklärung, siehe oben)
        "telegram.0",                                                   // [04] Instanz                  (Erklärung, siehe oben)
        60,                                                             // [05] Zeitspanne Versenden     (Erklärung, siehe oben)
        "person",                                                       // [06] Objekt-Typ               (Erklärung, siehe oben)
        75                                                              // [07] Mindesterkennungsrate    (Erklärung, siehe oben)
    ),
    new AlexaAlarm(                                                  
        true,                                                           // [08] Alexa aktiv              (Erklärung, siehe oben)
        300,                                                            // [09] Zeitspanne s (nur 1x in) (Erklärung, siehe oben)
        "person",                                                       // [10] Objekt-Typ               (Erklärung, siehe oben)
        75                                                              // [11] Mindesterkennungsrate    (Erklärung, siehe oben)
    ),
    new FileAlarm(                                                  
        true,                                                           // [12] File-Alarm aktiv         (Erklärung, siehe oben)
        "/home/uwe72/export4nginx/",                                    // [13] Basis-Verzeichnis        (Erklärung, siehe oben)
        60,                                                             // [14] Zeitspanne Versenden     (Erklärung, siehe oben)
        "person",                                                       // [15] Objekt-Typ               (Erklärung, siehe oben)
        75                                                              // [16] Mindesterkennungsrate    (Erklärung, siehe oben)
    ),
    new DetectionState(
        false,                                                          // [17] Schreiben in State aktiv (Erklärung, siehe oben)
        "0_userdata.0.clement.detection.Haustuere",                     // [18] Datenpunkt               (Erklärung, siehe oben)                
    )
);

// ####################################################################################################
// # HANDLUNGSBEDARF 3 von 4: ALEXA-DURCHSAGE ANPASSEN (OPTIONAL, nur falls oben bei Alexa-Active=true#
// ####################################################################################################

/**
 * Falls Alexa als Alarm konfiguriert ist wird diese Methode im Falle eines Alarms ausgelöst, allerdings nur einmal im konfiguriertem Intervall
 */
function handleAlexaAlarm(numberObjectDetectionsWithinImage) {

    // Was soll gesprochen werden:
    var sayThis = "Es ist eine Person im Eingangsbereich";
    if (numberObjectDetectionsWithinImage > 1) {
        sayThis = "Es sind "+ numberObjectDetectionsWithinImage + " Personen im Eingangsbereich";
    }

    // Alexa:
    setState("alexa2.0.Echo-Devices.34343434.Commands.speak", sayThis); 		

    // Google Home:
    setState("sayit.0.tts.text", sayThis);    
}

// ####################################################################################################
// # HANDLUNGSBEDARF 4 von4 : ANPASSEN IN WELCHEM INTERVALL BILDERKENNUNG DURCHGEFÜHRT WERDEN SOLL    #
// ####################################################################################################

/**
 * Alle 700ms wird die Bilderkennung durchgführt. Gerne anpassen. Diese Zeit kann/sollte angepasst werden
 */
setInterval(function() { 
    doDetection();   
}, 700);   

// ####################################################################################################
// # <<< [ENDE] KONFIGURATION                                                                         #
// ####################################################################################################

// AB hier keine Änderungen mehr vornehmen !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

/**
 * Datenpunkt anlegen in den die Bilderkennungsergebnisse abgespeichert werden
 */
if (camera.detectionState.isActive) {
    createState(camera.detectionState.stateName, "", {
        name: "Kamera " + camera.name,
        desc: "Bilderkennungsergebnisse der Kamera " + camera.name,
        type: 'string', 
        read: true,
        write: true
    });
}

/**
 * Alle 10 Sekunden prüfen wir, ob es eine Nachricht mit einer Erkennung zu versenden gibt
 * Bitte hier eher nichts ändern
 */
setInterval(function() { 
    if (camera.telegramAlarm.isActive) {
        executeTelegramAlarm();
    }
    if (camera.fileAlarm.isActive) {
        executeFileAlarm();
    }
}, 1000*10);   

// ...

// ####################################################################################################
// # !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!       #
// # --- Bei mehreren Kameras (Scripten) am besten ab hier NACH GLOBAL AUSLAGERN                      #
// # (ab hier keine Änderungen mehr vornehmen!)                                                       #
// # !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!       #
// ####################################################################################################

// ...

// ####################################################################################################
// # >>> [START] BILDERKENNUNG (tensorflow)                                                           #
// ####################################################################################################
var runningNumber = 0;
var model;

/**
 * Wir speichern uns die Bilder im Memory um die Festplatte nicht zu belasten. Zudem malen wir die Boxes nur auf die Erkennungsbilder wenn das Bild auch versendet wird, z.B. mit Telegram
 * Nicht jedes erkannte Bild wird versendet, deshalb speichern wir uns die Koordinaten um ggf. zu einem späteren Zeitpunkt (nur beste Bild der letzten z.B. 60s wird nach Telegram versendet)
 * Key: currentImageMemoryFileName, Value: Koordinaten bzw. Detection-Ergebnis
 */
var memoryFileName2DetectionResultsMap = new Map();

/**
 * In einem bestimmten Intervall wird die Bilderkennung aufgerufen
 */
function doDetection() {
    var now = new Date();
    request.get({url: camera.url, encoding: null}, async function (err, response, body) {
        if (model == null) {
            model = await cocoSsd.load();
        }
        var imgTensor = tf.node.decodeImage(body, 3);
        var predictions = await model.detect(imgTensor); 
        var json = JSON.stringify(predictions, null, 2);
        var detectionJsonResults = JSON.parse(json);

        // In die Datenpunkte schreiben:        
        if (camera.detectionState.isActive) {
            setState(camera.detectionState.stateName, json);
        }

        // Alarme vorhanden?!
        if (camera.telegramAlarm.isActive || camera.alexaAlarm.isActive || camera.fileAlarm.isActive) {
            findAndScheduleAlarms(detectionJsonResults, body);
        }
    });
 }

/**
 * Hier wird geschaut, ob sich aus einer aktuellen Bilderkennung einen Telegram-Alarm, Mail-Alarm, Alexa,... ergbit. Falls ja wird dieser zum Versand eingeplant (je nach Konfiguration. z.B. in 60s)
 * Erfolgen in diesem Intervall weitere Alarme so wird sich jeweils der beste gemerkt, nur dieser wird am Ende nach Telegram versendet
 */
function findAndScheduleAlarms(detectionJsonResults, body) {
    var isTelegramAlarmFound = false;  
    var isFileAlarmFound = false;  
    var isAlexaAlarmFound = false;  

    // Alle erkannten Objekttypen durchgehen:
    var currentTelegramScoreRate = 0;    
    var currentFileScoreRate = 0;    
    var numberAlexaHits = 0;
    detectionJsonResults.forEach(function (detectionResultElement, index) {
        var percent = detectionResultElement.score * 100;

        // Telegram: Schauen, ob die hinterlegte Condition erfüllt werden:
        if (camera.telegramAlarm.isActive && detectionResultElement.class == camera.telegramAlarm.className) {
            log("[Telegram-Alarm] Found score: " + detectionResultElement.score);
            if (percent >= camera.telegramAlarm.minScore) {
                isTelegramAlarmFound = true;
            }
            if (detectionResultElement.score > currentTelegramScoreRate) {
                currentTelegramScoreRate = detectionResultElement.score;
            }
        } 

        // Alexa-Alarm:
        if (camera.alexaAlarm.isActive && detectionResultElement.class == camera.alexaAlarm.className) {
        
            log("[Alexa-Alarm] Found score: " + detectionResultElement.score);
            numberAlexaHits += 1;
            if (percent >= camera.alexaAlarm.minScore) {
                isAlexaAlarmFound = true;
            }
        }

        // File-Alarm: Schauen, ob die hinterlegte Condition erfüllt werden:
        if (camera.fileAlarm.isActive && detectionResultElement.class == camera.fileAlarm.className) {
            log("[File-Alarm] Found score: " + detectionResultElement.score);
            if (percent >= camera.fileAlarm.minScore) {
                isFileAlarmFound = true;
            }
            if (detectionResultElement.score > currentFileScoreRate) {
                currentFileScoreRate = detectionResultElement.score;
            }
        } 
    });

    // Die Koordinaten müssen wir uns dann merken, da wir sie später noch brauchen beim Versand um die BoundingBoxes zu malen:
    var now;    
    if (isTelegramAlarmFound || isFileAlarmFound) {
        now = new Date().getTime();    

        runningNumber++;
        if (runningNumber > 100) { // max. 100 Bilder 
            runningNumber = 0;
        }

        var currentImageMemoryFileName = "/opt/iobroker/temp_" + getScriptName() + "_" + "alarm_" + camera.name + "_" + runningNumber + ".jpg";
        disk_fs.writeFile(currentImageMemoryFileName, body, function (err) {
            if (err) {
                console.error("Fehler beim Speichern des Bildes: " + err);
            } else {
                memoryFileName2DetectionResultsMap.set(currentImageMemoryFileName, detectionJsonResults);

                // Telegram Alarm vorhanden:
                if (isTelegramAlarmFound) {

                    // Timer stellen?!:
                    if (telegramSendAlarmDateMs == null) {
                        telegramSendAlarmDateMs = now + (camera.telegramAlarm.intervallSeconds * 1000);
                    }

                    // Beste Bild im Intervall?!
                    if (currentTelegramScoreRate >= telegramBestScoreRateWithinCurrentIntervall) {
                        telegramBestScoreRateWithinCurrentIntervall = currentTelegramScoreRate;
                        telegramBestImageMemoryFileNameWithinCurrentIntervall = currentImageMemoryFileName;
                    }
                } 

                // File Alarm vorhanden:
                if (isFileAlarmFound) {

                    // Timer stellen?!:
                    if (fileSendAlarmDateMs == null) {
                        fileSendAlarmDateMs = now + (camera.fileAlarm.intervallSeconds * 1000);
                    }

                    // Beste Bild im Intervall?!
                    if (currentFileScoreRate >= fileBestScoreRateWithinCurrentIntervall) {
                        fileBestScoreRateWithinCurrentIntervall = currentFileScoreRate;
                        fileBestImageMemoryFileNameWithinCurrentIntervall = currentImageMemoryFileName;
                    }
                } 
                

            }
        });
    }


    // Alexa-Alarm vorhanden:
    if (isAlexaAlarmFound) {
        executeAlexaAlarm(numberAlexaHits);
    }
}

// ####################################################################################################
// # <<< [ENDE] BILDERKENNUNG (tensorflow)                                                            #
// ####################################################################################################

// ... 

// ####################################################################################################
// # >>> [START] ALEXA ALARM HANDLING                                                                 #
// ####################################################################################################
var lastOccuredAlexaAlarmInMs = -1;

// ALARM:
function executeAlexaAlarm(numberAlexaHits) {
    var nowDate = new Date();
    if (nowDate.getHours() != 6) {  // Nicht zwischen 6 und 7 Uhr morgens ;-)
        var differenzAlexa = 0;
        if (lastOccuredAlexaAlarmInMs != -1) {
            differenzAlexa = new Date().getTime() - lastOccuredAlexaAlarmInMs;            
        } else {
            differenzAlexa = 9999999;
        }
        if (differenzAlexa > (camera.alexaAlarm.intervallSeconds *1000)) { // nur einmal im konfiguriertem Intervall
            handleAlexaAlarm(numberAlexaHits);
            lastOccuredAlexaAlarmInMs = new Date().getTime();
        }
    }
};

// ####################################################################################################
// # >>> [START] TELEGRAM ALARM HANDLING                                                              #
// ####################################################################################################
var telegramBestScoreRateWithinCurrentIntervall = -1;
var telegramBestImageMemoryFileNameWithinCurrentIntervall = "";
var telegramSendAlarmDateMs = null;

/**
 * Hier wird final die Telegram Nachricht versendet mit dem besten Erkennungsbild aus dem aktuellen Erkennungsintervall
 */
function executeTelegramAlarm() {
    if (telegramSendAlarmDateMs != null) {
        var now = new Date().getTime();
        if (now > telegramSendAlarmDateMs) {
            var frozenFile = telegramBestImageMemoryFileNameWithinCurrentIntervall;
            var frozenScoreRate = telegramBestScoreRateWithinCurrentIntervall;
            log("[Telegram-Alarm] Zielzeit erreicht. Versende Bild: " + frozenFile);

            // Laden des Bildes:
            log("[Telegram-Alarm] ...Original-Erkennungsbild aus RAM laden.");
            disk_fs.readFile(frozenFile,
                async function read(err, data) {
                    if (err) {
                        throw err;
                    }

                    // Jetzt malen wir die Erkunngsboxen um die erkannten Objekte:
                    log("[Telegram-Alarm] .........Erkennungsboxen (was wurde erkannt, mit welcher Rate) auf Bild malen");                                        
                    var detectionJsonResults = memoryFileName2DetectionResultsMap.get(frozenFile);
                    var boxesFilename = frozenFile.replace(".jpg", "_boxes.jpg");
                    drawDetectionBoxes(detectionJsonResults, frozenFile, boxesFilename, function(result) { 

                        // Und jetzt final nach Telegram versenden:                                
                        var frozenScoreRateString = (frozenScoreRate * 100).toFixed(0);
                        var subject = camera.name + " (" + getTranslationForClassName(camera.telegramAlarm.className) + " " + frozenScoreRateString + " %) "+ frozenFile;
                        log("[Telegram-Alarm] ............Bild nach Telegram versenden");                                        
                        sendTo('telegram.0', {text: boxesFilename, caption: subject});

                        // Werte zurücksetzen, neues Erkennungsintervall beginnt:
                        telegramBestScoreRateWithinCurrentIntervall = -1;
                        telegramBestImageMemoryFileNameWithinCurrentIntervall = "";
                        telegramSendAlarmDateMs = null;
                    });  

                }
            );
        } else {
            var duration = (telegramSendAlarmDateMs-now)/1000;
            var durationString = duration.toFixed(0);
            log("[Telegram-Alarm] Zielzeit noch nicht erreicht. Es fehlen " + durationString + " Sekunden");
        }
    }
}

// ####################################################################################################
// # <<< [ENDE] TELEGRAM ALARM HANDLING                                                               #
// ####################################################################################################

// .....

// ####################################################################################################
// # >>> [START] FILE ALARM HANDLING                                                                  #
// ####################################################################################################
var fileBestScoreRateWithinCurrentIntervall = -1;
var fileBestImageMemoryFileNameWithinCurrentIntervall = "";
var fileSendAlarmDateMs = null;

/**
 * Hier wird final das Bild auf dem Verzeichnissystem abgelegt mit dem besten Erkennungsbild aus dem aktuellen Erkennungsintervall
 */
function executeFileAlarm() {
    if (fileSendAlarmDateMs != null) {
        var now = new Date().getTime();
        if (now > fileSendAlarmDateMs) {
            var frozenFile = fileBestImageMemoryFileNameWithinCurrentIntervall;
            var frozenScoreRate = fileBestScoreRateWithinCurrentIntervall;
            log("[File-Alarm] Zielzeit erreicht. Versende Bild: " + frozenFile);

            // Dann holen wir das Bild aus dem Memory:
            log("[File-Alarm] ...Original-Erkennungsbild laden.");
            disk_fs.readFile(frozenFile,
                async function read(err, data) {
                    if (err) {
                        throw err;
                    }
                
                    // Auf Festplatte schreiben:
                    let fileOutputFilename = camera.fileAlarm.baseDirectory + "Kamera_" + camera.name + "_Last_Detection.jpg";
                    log("[File-Alarm] ......Original-Erkennungsbild auf Disk speichern: " + fileOutputFilename);                                        
                    disk_fs.writeFile(fileOutputFilename, data, 'binary', function(err) { 
                        if (err) {
                            log("Error123" + err);
                        } else {

                            // Jetzt malen wir noch die Erkunngsboxen um die erkannten Objekte und aktualisieren das bereits gespeicherte Bild auf der Festplatte:
                            log("[File-Alarm] .........Erkennungsboxen (was wurde erkannt, mit welcher Rate) auf Bild malen");                                        
                            var detectionJsonResults = memoryFileName2DetectionResultsMap.get(frozenFile);
                            drawDetectionBoxes(detectionJsonResults, fileOutputFilename, fileOutputFilename, function(result) { 

                                // Zudem noch Bild in einem Unterordner mit einem Zeitstempel abspeichern.
                                var d = new Date();
                                var fileName = d.getHours().toString().padStart(2,'0') + d.getMinutes().toString().padStart(2,'0') + d.getSeconds().toString().padStart(2,'0') + ".jpg";
                                var folder = camera.fileAlarm.baseDirectory + "Kamera_Alarm/" + formatDate(new Date(), "JJJJ-MM-TT") + "/" + camera.name + "/";
                                disk_fs.mkdir(folder, { recursive: true }, (err) => {
                                    if (err) {
                                        console.error("Berechtigungsthema?! Fehler beim alegen des Ordners " + folder);
                                        throw err;
                                    } else {
                                        disk_fs.createReadStream(fileOutputFilename).pipe(disk_fs.createWriteStream(folder + fileName));
                                    }; 
                                });

                                // Werte zurücksetzen, neues Erkennungsintervall beginnt:
                                fileBestScoreRateWithinCurrentIntervall = -1;
                                fileBestImageMemoryFileNameWithinCurrentIntervall = "";
                                fileSendAlarmDateMs = null;
                            });  
                        }
                    });

                }
            );
        } else {
            var duration = (fileSendAlarmDateMs-now)/1000;
            var durationString = duration.toFixed(0);
            log("[File-Alarm] Zielzeit noch nicht erreicht. Es fehlen " + durationString + " Sekunden");
        }
    }
}

// ####################################################################################################
// # <<< [ENDE] FILE ALARM HANDLING                                                                   #
// ####################################################################################################

// .....

// ####################################################################################################
// # >>> [START] HILFSBEREICH > ZEICHNEN DER BOUNDING BOXES                                           #
// ####################################################################################################

/**
 * Hier werden die Boundingboxes auf das Originalbild gemalt
 */
 function drawDetectionBoxes(detectionJsonResults, inputFilename, outputFilename, callback) {
    var drawing = gm(inputFilename);
    var title = camera.name;
    var titleFontSize = 25;
    var titleFontName = "Arial";
    var widthTitle = pixelWidth(title, { font: titleFontName, size: titleFontSize, bold: false, italic: false });

    drawing = drawing.stroke("#000000",1);
    drawing = drawing.fill("#ffffff");
    drawing = drawing.drawRectangle(10,10, widthTitle + 30, 40);
    drawing = drawing.font(titleFontName, titleFontSize);
    drawing = drawing.drawText(20,33, title);

    const dim = sizeOf(inputFilename);

    detectionJsonResults.forEach(function (element, index) {
        drawing = drawing.stroke(getBoxColorForClassName(element.class), 3);
        drawing = drawing.drawLine(correctX(dim, element.bbox[0]), correctY(dim, element.bbox[1]), correctX(dim, element.bbox[0]+element.bbox[2]), correctY(dim, element.bbox[1])); // Horizontale Linie oben        
        drawing = drawing.drawLine(correctX(dim, element.bbox[0]), correctY(dim, element.bbox[1]+element.bbox[3]), correctX(dim, element.bbox[0]+element.bbox[2]), correctY(dim, element.bbox[1]+element.bbox[3])); // Horizontale Linie unten
        drawing = drawing.drawLine(correctX(dim, element.bbox[0]), correctY(dim, element.bbox[1]), correctX(dim, element.bbox[0]), correctY(dim, element.bbox[1]+element.bbox[3])); // Vertikale Linie links
        drawing = drawing.drawLine(correctX(dim, element.bbox[0]+element.bbox[2]), correctY(dim, element.bbox[1]), correctX(dim, element.bbox[0]+element.bbox[2]), correctY(dim, element.bbox[1] + element.bbox[3])); // Vertikale Linie rechts
        drawing = drawing.fill(getBoxColorForClassName(element.class));
        var percent = element.score * 100;
        var percentString = percent.toFixed(0);
        var text = getTranslationForClassName(element.class) + " (" + percentString + " %)";
        var fontSize = 15;
        var fontName = "Arial";
        var width = pixelWidth(text, { font: fontName, size: fontSize, bold: false, italic: false });

        drawing = drawing.drawRectangle(correctX(dim, element.bbox[0]), correctY(dim, element.bbox[1]+element.bbox[3])-30, correctX(dim, element.bbox[0])+width+20, correctY(dim, element.bbox[1]+element.bbox[3]));
        drawing = drawing.stroke("#000000",1);
        drawing = drawing.font(fontName, fontSize);
        drawing = drawing.drawText(correctX(dim, element.bbox[0])+10, correctY(dim, element.bbox[1]+element.bbox[3])-10, text);

    });
    drawing.write(outputFilename, function (err) {
        if (err) {
            console.error("!!!! Error writing in boxes: " + err);
            callback(false);
        } else {
            callback(true);
        }
    });
 }

/**
 * Korrektur der gelieferten Werte: Falls die Boundingbox aus dem horizontalen Bereich rausläuft
 */
 function correctX(imageDimensions, coordinateX) {
     if (coordinateX < 0) {
         return 1;
     } else if (coordinateX > imageDimensions.width) {
         return coordinateX-1;
     }
     return coordinateX;
 }

/**
 * Korrektur der gelieferten Werte: Falls die Boundingbox aus dem vertikalen Bereich rausläuft
 */
 function correctY(imageDimensions, coordinateY) {
     if (coordinateY < 0) {
         return 1;
     } else if (coordinateY > imageDimensions.height) {
         return coordinateY-1;
     }
     return coordinateY;
 }

/**
 * Übersetzung der Objekte
 */
 function getTranslationForClassName(className) {
     if (className == "person") {
         return "Person";
     } else if (className == "car") {
         return "Auto";
     } else if (className == "potted plant") {
         return "Pflanztopf";
     } else {
         return "[" + className + "]";
     }
 }

/**
 * Farben für die Objekte für das Zeichnen der Bounding-Boxes
 */
 function getBoxColorForClassName(className) {
     if (className == "car") {
         return "#3379CF"; // blue
     } else if (className == "person") {
         return "#C63136"; // red
     } else if (className == "potted plant") {
         return "#468D3F"; // green
     } else {
         return "#7826A3"; // lila
     }
 }

// ####################################################################################################
// # <<< [ENDE] HILFSBEREICH > ZEICHNEN DER BOUNDING BOXES                                            #
// ####################################################################################################

// .....

// ####################################################################################################
// # >>> [START] SONSTIGES (Datentypen,...)                                                           #
// ####################################################################################################

function TelegramAlarm(isActive, telegramInstance, intervallSeconds, className, minScore) {
    this.isActive = isActive;
    this.telegramInstance = telegramInstance;
    this.intervallSeconds = intervallSeconds;
    this.className = className;
    this.minScore = minScore;
}

function FileAlarm(isActive, baseDirectory, intervallSeconds, className, minScore) {
    this.isActive = isActive;
    this.baseDirectory = baseDirectory;
    this.intervallSeconds = intervallSeconds;
    this.className = className;
    this.minScore = minScore;
}

function AlexaAlarm(isActive, intervallSeconds, className, minScore) {
    this.isActive = isActive;
    this.intervallSeconds = intervallSeconds;
    this.className = className;
    this.minScore = minScore;
}

function DetectionState(isActive, stateName) {
    this.isActive = isActive;
    this.stateName = stateName;
}

function Camera(url, name, telegramAlarm, alexaAlarm, fileAlarm, detectionState) {
    this.url = url;
    this.name = name;
    this.telegramAlarm = telegramAlarm;
    this.alexaAlarm = alexaAlarm;
    this.fileAlarm = fileAlarm;
    this.detectionState = detectionState;
} 

function getScriptName() {
    var scriptName = name;
    scriptName = scriptName.substring(scriptName.lastIndexOf(".")+1);
    return scriptName;
}

// ####################################################################################################
// # <<< [ENDE] SONSTIGES (Datentypen,...)                                                            #
// ####################################################################################################










