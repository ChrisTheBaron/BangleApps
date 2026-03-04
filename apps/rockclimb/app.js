const appid = "rockclimb";

const grades = [
    '4', '4+',
    '5', '5+',
    '6a', '6a+',
    '6b', '6b+',
    '6c', '6c+',
    '7a', '7a+',
    '7b', '7b+'
];

const inclines = [
    'Slab',
    'Vertical',
    'Overhang'
];

const types = [
    'Normal',
    'One Handed',
    'Twister',
    'Climbdown',
    'Weighted'
];

const sampleRate = 1000;//TODO: Setting

let typeIndex = 0;
let inclineIndex = 0;
let gradeIndex = 0;

function getDateStr(d){
    return d.toISOString().substring(0,10);
}

const today = getDateStr(new Date());

function getTodayCount(){
    const r = new RegExp("^" + appid + "\." + today + "\..*" + "\.json$");
    const t = require("Storage").list(r);
    return t.length;
}

// Recording state
let recordData = [];
let recordInterval;
let hrValue = 0;
let hrListener;
let altValue = 0;
let altListener;
let startTime;

function startRecording() {
    recordData = [];
    hrValue = 0;
    altValue = 0;

    Bangle.setHRMPower(true, appid);
    hrListener = hr => { hrValue = hr.bpm; };
    Bangle.on('HR', hrListener);

    Bangle.setBarometerPower(true, appid);
    altListener = alt => { altValue = alt.altitude; };
    Bangle.on('pressure', altListener);

    startTime = Date.now();

    recordInterval = setInterval(() => {
        const now = Date.now();
        recordData.push({
            t: now - startTime,
            hr: hrValue,
            alt: altValue
        });
    }, sampleRate);

    E.showMenu({
        "": { title:"Recording..." },
        "Stop": stopRecording
    });
}

function stopRecording() {
    if(recordInterval) clearInterval(recordInterval);

    if(hrListener) Bangle.removeListener('HR', hrListener);
    Bangle.setHRMPower(false, appid);

    if(altListener) Bangle.removeListener('pressure', altListener);
    Bangle.setBarometerPower(false, appid);

    const filename = appid+"."+getDateStr(new Date(startTime))+"."+(getTodayCount()+1)+".json";

    require("Storage").writeJSON(filename, {
        start: startTime,
        type: types[typeIndex],
        incline: inclines[inclineIndex],
        grade: grades[gradeIndex],
        data: recordData
    });

    showMainMenu();
}

function showMainMenu() {
    E.showMenu({
        "": { title: "Climb ("+getTodayCount()+" Today)" },
        "Record": () => startRecording(),
        "Grade": {
            value: gradeIndex,
            min: 0,
            max: grades.length - 1,
            step: 1,
            wrap: true,
            format: v => grades[v],
            onchange: v => gradeIndex = v
        },
        "Incline": {
            value: inclineIndex,
            min: 0,
            max: inclines.length - 1,
            step: 1,
            wrap: true,
            format: v => inclines[v],
            onchange: v => inclineIndex = v
        },
        "Type": {
            value: typeIndex,
            min: 0,
            max: types.length - 1,
            step: 1,
            wrap: true,
            format: v => types[v],
            onchange: v => typeIndex = v
        },
    });
}

showMainMenu();