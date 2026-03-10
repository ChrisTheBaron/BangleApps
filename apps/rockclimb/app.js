const storage = require('Storage');

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
    const r = new RegExp("^" + appid + "\." + today + "\..*" + ".json$");
    const t = storage.list(r);
    return t.length;
}

function elapsedString(ms) {
    const s = (ms / 1000) | 0;
    return `${((s/60)|0).toString().padStart(2, "0")}:${(s%60).toString().padStart(2,"0")}`;
}

let hrListener;
let altListener;
let startTime;
let fileName;

function startRecording() {
    const count = getTodayCount()+1;
    startTime = Date.now();
    fileName = appid+"."+getDateStr(new Date(startTime))+"."+count;
    const dataFile = storage.open(fileName+".csv", 'a');
    dataFile.write("time,type,value\n");

    Bangle.setHRMPower(true, appid);
    hrListener = hr => {
        if(hr.bpm > 0) dataFile.write(""+(Date.now() - startTime).toFixed(0)+",h,"+hr.bpm+"\n");
    };
    Bangle.on('HRM', hrListener);

    Bangle.setBarometerPower(true, appid);
    altListener = alt => {
        dataFile.write(""+(Date.now() - startTime).toFixed(0)+",a,"+alt.altitude.toFixed(2)+"\n");
    };
    Bangle.on('pressure', altListener);

    E.showMenu({
        "": { title:"Recording (" + count + ")"},
        "Another": ()=> stopRecording("another"),
        "Topped": () => stopRecording("topped"),
        "Nearly": () => stopRecording("nearly"),
        "Cancel": () => stopRecording("cancel"),
    });

}

function stopRecording(state) {

    if(hrListener) Bangle.removeListener('HRM', hrListener);
    Bangle.setHRMPower(false, appid);

    if(altListener) Bangle.removeListener('pressure', altListener);
    Bangle.setBarometerPower(false, appid);

    if(state !== "cancel"){
        storage.writeJSON(fileName + ".json", {
            start: startTime.toFixed(0),
            end: Date.now().toFixed(0),
            completed: (state === "topped" || state === "another"),
            type: types[typeIndex],
            incline: inclines[inclineIndex],
            grade: grades[gradeIndex]
        });
    } else {
        const dataFile = storage.open(fileName+".csv", 'r');
        dataFile.erase();
    }

    if(state === "another"){
        startRecording();
    } else {
        showMainMenu();
    }

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