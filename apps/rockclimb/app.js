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

let typeIndex = 0;
let inclineIndex = 0;
let gradeIndex = 0;

function showMainMenu() {
    E.showMenu({
        "": { title: "Rock Climb" },

        "Record": () => {
            // Your save logic here
        },

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