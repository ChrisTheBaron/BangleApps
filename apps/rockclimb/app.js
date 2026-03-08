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

function Holt(alpha, beta) {
    this.a = alpha;   // level smoothing
    this.b = beta;    // trend smoothing
    this.l = 0;       // level
    this.t = 0;       // trend
    this.init = false;
}

Holt.prototype.add = function(x) {
    if (!this.init) {
        this.l = x;
        this.t = 0;
        this.init = true;
        return x;
    }

    let prev = this.l;
    this.l = this.a * x + (1 - this.a) * (this.l + this.t);
    this.t = this.b * (this.l - prev) + (1 - this.b) * this.t;

    return this.l;
};

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

// Recording state
let recordInterval;
let hrListener;
let altListener;
let startTime;
let fileName;
let altSmoother;

function startRecording() {
    let hrValue = 0;
    let altValue = 0;
    altSmoother = new Holt(0.4, 0.1);
    startTime = Date.now();
    fileName = appid+"."+getDateStr(new Date(startTime))+"."+(getTodayCount()+1);
    const dataFile = storage.open(fileName+".csv", 'a');

    Bangle.setHRMPower(true, appid);
    hrListener = hr => { hrValue = hr.bpm; };
    Bangle.on('HRM', hrListener);

    Bangle.setBarometerPower(true, appid);
    altListener = alt => {
        altValue = altSmoother.add(alt.altitude);
    };
    Bangle.on('pressure', altListener);

    dataFile.write("time,hr,alt\n");

    recordInterval = setInterval(() => {
        dataFile.write(""+(Date.now() - startTime).toFixed(0)+","+hrValue+","+altValue.toFixed(2)+"\n");
        showRecording(hrValue, altValue);
    }, sampleRate);

    showRecording(hrValue, altValue);

}

function showRecording(hr, alt){
    const elapsed = elapsedString(Date.now() - startTime);
    E.showMenu({
        "": { title:"Recording..." },
        "Stop": stopRecording,
        "Elapsed": { value: elapsed },
        "BPM": { value: hr.toFixed(0) },
        "Alt": { value : alt.toFixed(0) }
    });
}

function stopRecording() {
    if(recordInterval) clearInterval(recordInterval);

    if(hrListener) Bangle.removeListener('HRM', hrListener);
    Bangle.setHRMPower(false, appid);

    if(altListener) Bangle.removeListener('pressure', altListener);
    Bangle.setBarometerPower(false, appid);

    storage.writeJSON(fileName + ".json", {
        start: startTime.toFixed(0),
        type: types[typeIndex],
        incline: inclines[inclineIndex],
        grade: grades[gradeIndex]
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