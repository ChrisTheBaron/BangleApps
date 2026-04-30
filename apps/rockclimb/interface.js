async function onInit() {

    Util.showModal("Loading...");

    const appmetadata = await (await fetch('metadata.json')).json();

    const dataEl = document.getElementById('data');

    const allfiles = await new Promise(resolve => {
        Puck.eval(`require("Storage").list(/^rockclimb.*\\.json$/)`, resolve);
    });

    if (allfiles.length === 0) {
        dataEl.innerHTML = `<p>No recordings found.</p>`;
        Util.hideModal();
        return;
    }

    let files = {};
    let csvs = {};
    let html = ``;

    const sessions = Object.groupBy(allfiles, f => f.substring(10, 20));

    for (let session in sessions) {

        const sessionfiles = sessions[session];
        const sessionDate = new Date(session);

        html += `<details><summary>${sessionDate.toDateString()}</summary>`;

        html += `<div>`;

        html += `<a href="#" action="downloadSession" session="${session}">Download Session</a>&nbsp;|&nbsp;<a href="#" action="deleteSession" session="${session}">Delete Session</a>`;

        for (let file of sessionfiles) {
            const json = await new Promise(resolve => Util.readStorageJSON(file, resolve));
            files[file] = json;
            const tags = getTags(json);
            const date = new Date(parseInt(json.start));
            html += `<details filename="${file}">
  <summary>${date.toLocaleTimeString()} - ${json.grade} ${json.incline} ${tags.map(t => `#${t}`).join(' ')}</summary>
  <a href="#" action="download" filename="${file}">Download Climb</a>&nbsp;|&nbsp;<a href="#" action="delete" filename="${file}">Delete Climb</a>
  <canvas id="chart-${file}">Loading...</canvas>
</details>`;
        }

        html += `</div></details>`;
    }

    dataEl.innerHTML = html;

    document.querySelectorAll(`details[filename]`).forEach(detail => {
        detail.addEventListener('toggle', async () => {
            Util.showModal(`Loading...`);

            const filename = detail.getAttribute('filename');
            const metadata = files[filename];

            try {

                if (!csvs[filename]) {
                    console.log(filename);
                    csvs[filename] = await new Promise(resolve => Util.readStorageFile(filename.replace('.json', '.csv'), resolve));
                }
                const {
                    error,
                    averaged,
                    ascentStartIndex,
                    ascentFinishIndex,
                    descentStartIndex,
                    descentFinishIndex,
                    diff
                } = parseElevation(csvs[filename]);

                const ctx = document.getElementById(`chart-${filename}`);
                const data = {
                    datasets: [
                        {
                            label: 'Elevation',
                            data: averaged,
                            backgroundColor: 'green'
                        },
                        //{
                        //    label: 'Ascent Start',
                        //    data: [
                        //        {x: averaged[ascentStartIndex].x, y: averaged[ascentStartIndex].y},
                        //        {x: averaged[ascentStartIndex].x, y: averaged[ascentFinishIndex].y}
                        //    ],
                        //    type: 'line',
                        //},
                        //{
                        //    label: 'Ascent End',
                        //    data: [
                        //        {x: averaged[ascentFinishIndex].x, y: averaged[ascentStartIndex].y},
                        //        {x: averaged[ascentFinishIndex].x, y: averaged[ascentFinishIndex].y}
                        //    ],
                        //    type: 'line',
                        //},
                        //{
                        //    label: 'Descent Start',
                        //    data: [
                        //        {x: averaged[descentStartIndex].x, y: averaged[descentStartIndex].y},
                        //        {x: averaged[descentStartIndex].x, y: averaged[descentFinishIndex].y}
                        //    ],
                        //    type: 'line',
                        //},
                        //{
                        //    label: 'Descent End',
                        //    data: [
                        //        {x: averaged[descentFinishIndex].x, y: averaged[descentStartIndex].y},
                        //        {x: averaged[descentFinishIndex].x, y: averaged[descentFinishIndex].y}
                        //    ],
                        //    type: 'line',
                        //},
                    ]
                };
                const config = {
                    type: 'line',
                    data: data,
                    options: {
                        animation: false,
                        scales: {
                            x: {
                                type: 'linear',
                                position: 'bottom',
                                min: error ? null : averaged[ascentStartIndex].x,
                                max: error ? null : metadata.climbDown ? averaged[descentFinishIndex].x : averaged[ascentFinishIndex].x,
                                ticks: {
                                    callback: (value) => elapsedString(value - averaged[ascentStartIndex].x)
                                }
                            },
                            y: {
                                min: error ? null : (metadata.climbDown ? Math.min(averaged[ascentStartIndex].y, averaged[descentFinishIndex].y) : averaged[ascentStartIndex].y) - diff * 10,
                                max: error ? null : (metadata.climbDown ? Math.max(averaged[ascentFinishIndex].y, averaged[descentStartIndex].y) : averaged[ascentFinishIndex].y) + diff * 10,
                                display: false
                            }
                        }
                    }
                };
                new Chart(ctx, config);
                Util.hideModal();

            } catch (err) {
                alert(`Failed to generate graph for file '${filename}' - ${err.message}`);
            }

        }, {once: true});
    });

    document.querySelectorAll(`a[action="downloadSession"]`).forEach(button => {
        button.addEventListener("click", async e => {
            const session = e.currentTarget.getAttribute("session");
            await downloadSession(session, sessions[session]);
        });
    });

    document.querySelectorAll(`a[action="deleteSession"]`).forEach(button => {
        button.addEventListener("click", async e => {
            if (!confirm("Delete all recordings for this session?")) return;
            const session = e.currentTarget.getAttribute("session");
            Util.showModal("Deleting...");
            let count = 0;
            for (let filename of sessions[session]) {
                Util.showModal(`Deleting (${count++}/${Object.keys(sessions).length})...`);
                await deleteData(filename);
            }
            Util.hideModal();
            await onInit();
        });
    });

    document.querySelectorAll(`a[action="download"][filename]`).forEach(button => {
        button.addEventListener("click", async e => {
            const filename = e.currentTarget.getAttribute("filename");
            await downloadData(filename);
            Util.hideModal();
        });
    });

    document.querySelectorAll(`a[action="delete"][filename]`).forEach(button => {
        button.addEventListener("click", async e => {
            if (!confirm("Delete?")) return;
            Util.showModal("Deleting...");
            const filename = e.currentTarget.getAttribute("filename");
            await deleteData(filename);
            Util.hideModal();
            await onInit();
        });
    });

    Util.hideModal();

    function lowPass(tau) {
        let prev = null;
        let prevTime = null;

        return (timestamp, value) => {
            if (prev === null) {
                prev = value;
                prevTime = timestamp;
                return value;
            }

            const dt = (timestamp - prevTime) / 1000; // ms → seconds

            // avoid issues with duplicate timestamps
            if (dt <= 0) return prev;

            const alpha = 1 - Math.exp(-dt / tau);

            prev = prev + alpha * (value - prev);
            prevTime = timestamp;

            return prev;
        };
    }

    /**
     * @param {String} datafile
     * @param {Number} startTime
     * @returns {String[]}
     */
    function buildTrkpts(datafile, startTime) {
        const datapoints = datafile.split('\n');
        const header = datapoints.shift(); // header
        datapoints.pop();   // trailing newline
        if (header.indexOf('hr') < 0) {
            return datapoints.map(dp => {
                const [offset, type, value] = dp.split(',');
                const time = new Date(parseInt(startTime) + parseInt(offset));
                return `<trkpt lat="0" lon="0">
                    <time>${time.toISOString()}</time>
                    ${type === 'a' ? `<ele>${parseFloat(value)}</ele>` : ''}
                    ${type === 'h' ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${parseFloat(value)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''}
                </trkpt>`;
            });
        } else {
            return datapoints.map(dp => {
                const [offset, hr, alt] = dp.split(',');
                const time = new Date(parseInt(startTime) + parseInt(offset));
                return `<trkpt lat="0" lon="0">
                    <time>${time.toISOString()}</time>
                    <ele>${parseFloat(alt)}</ele>
                    <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${parseFloat(hr)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
                </trkpt>`;
            });
        }
    }

    function parseElevation(datafile) {
        let raw = [];
        const datapoints = datafile.split('\n');
        const header = datapoints.shift(); // header
        datapoints.pop();   // trailing newline

        if (header.indexOf('hr') < 0) {
            datapoints.map(dp => {
                const [offset, type, value] = dp.split(',');
                if (type !== 'a') {
                    return;
                }
                raw.push({x: parseInt(offset), y: parseFloat(value)});
            });
        } else {
            datapoints.map(dp => {
                const [offset, hr, alt] = dp.split(',');
                raw.push({x: parseInt(offset), y: parseFloat(alt)});
            });
        }

        const first = lowPass(5);
        const second = lowPass(5);
        const third = lowPass(10);

        const start = raw[0].x;
        const end = raw[raw.length - 1].x;

        const forward = raw.map(e => ({x: e.x, y: first(e.x, e.y)}));
        const backward = raw.toReversed().map(e => ({x: e.x, y: second(end - e.x, e.y)})).toReversed();

        const averaged = [];

        for (let i in forward) {
            const f = i / forward.length;
            const b = 1 - f;
            averaged.push({x: forward[i].x, y: third(forward[i].x, forward[i].y * f + backward[i].y * b)});
        }

        let lowestElevation = Math.min(...averaged.map(x => x.y));
        let peakElevation = Math.max(...averaged.map(x => x.y));

        let diff = (peakElevation - lowestElevation) * 0.01;

        //First round we get estimates
        let ascentStartIndex = averaged.findIndex(x => x.y <= lowestElevation + diff);
        let ascentFinishIndex = averaged.findLastIndex(x => x.y >= peakElevation - diff);

        peakElevation = Math.max(...averaged.slice(ascentStartIndex).map(x => x.y));
        diff = (peakElevation - lowestElevation) * 0.01;

        console.log({ascentStartIndex, ascentFinishIndex});

        //Defaults if not found
        if (ascentStartIndex < 0) ascentStartIndex = 0;
        if (ascentFinishIndex < 0) ascentFinishIndex = averaged.length - 1;

        //Second round we can use estimates as bounds
        ascentStartIndex = averaged.slice(ascentStartIndex).findLastIndex(x => x.y <= lowestElevation + diff) + ascentStartIndex;
        ascentFinishIndex = averaged.slice(ascentStartIndex).findIndex(x => x.y >= peakElevation - diff) + ascentStartIndex;

        console.log({ascentStartIndex, ascentFinishIndex});

        //Default again
        if (ascentStartIndex < 0) ascentStartIndex = 0;
        if (ascentFinishIndex < 0) ascentFinishIndex = averaged.length - 1;

        const secondHalf = averaged.slice(ascentFinishIndex);
        const descentFinishElevation = Math.min(...secondHalf.map(x => x.y));

        //Default to end of ascent if not found
        let descentStartIndex = secondHalf.findLastIndex(x => x.y > peakElevation - diff) + ascentFinishIndex;
        if (descentStartIndex < ascentFinishIndex) descentStartIndex = ascentFinishIndex;

        //Default to end if not found
        let descentFinishIndex = secondHalf.findIndex(x => x.y < descentFinishElevation + diff) + ascentFinishIndex;
        if (descentFinishIndex < ascentFinishIndex) descentFinishIndex = averaged.length - 1;

        return {
            error: ascentStartIndex === ascentFinishIndex,
            raw,
            averaged,
            ascentStartIndex,
            ascentFinishIndex,
            descentStartIndex,
            descentFinishIndex,
            diff
        };
    }

    /**
     * @param {String} filename
     * @param {Object} metadata
     * @param {String[]} trkpts
     * @param {Number} trackNo
     * @returns {string}
     */
    function buildTrk(filename, metadata, trkpts, trackNo) {
        const {
            averaged,
            ascentStartIndex,
            ascentFinishIndex,
            descentStartIndex,
            descentFinishIndex
        } = parseElevation(csvs[filename]);
        const tags = getTags(metadata);
        let description = `Ascent Duration: ${elapsedString(averaged[ascentFinishIndex].x - averaged[ascentStartIndex].x)}`;
        let timestamps = `ascent-start="${new Date(parseInt(metadata.start) + averaged[ascentStartIndex].x).toISOString()}"
            ascent-finish="${new Date(parseInt(metadata.start) + averaged[ascentFinishIndex].x).toISOString()}"`;
        if (metadata.climbDown) {
            timestamps += ` descent-start="${new Date(parseInt(metadata.start) + averaged[descentStartIndex].x).toISOString()}"
            descent-finish="${new Date(parseInt(metadata.start) + averaged[descentFinishIndex].x).toISOString()}"`;
            description += `\nDescent Duration: ${elapsedString(averaged[descentFinishIndex].x - averaged[descentStartIndex].x)}`;
        }
        if (tags.length > 0) {
            description += `\n${tags.map(t => `#${t}`).join(' ')}`;
        }
        return `
<trk>
  <metadata>
    <time>${new Date(parseInt(metadata.start)).toISOString()}</time>
    <extensions>
      <climb:route incline="${metadata.incline}" grade="${metadata.grade}" completed="${metadata.completed ?? true}" ${timestamps}>
        ${tags.map(t => `<climb:tag>${t}</climb:tag>`).join('')}
      </climb:route>
    </extensions>
  </metadata>
  <name>${metadata.grade} ${metadata.incline}</name>
  <src>${appmetadata["name"]} v${appmetadata["version"]}</src>
  <number>${trackNo}</number>
  <type>Indoor Climb</type>
  <desc><![CDATA[${description}]]></desc>
  <trkseg>${trkpts.join('')}</trkseg>
</trk>`;
    }

    /**
     * @param {String[]} tracks
     * @returns {String}
     */
    function wrapGpx(tracks) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="${appmetadata["name"]} v${appmetadata["version"]}" version="1.1"
xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd"
xmlns="http://www.topografix.com/GPX/1/1/"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
xmlns:climb="https://christhebaron.co.uk/BangleApps/apps/rockclimb/rockclimb.xsd">
<metadata>
  <time>${new Date().toISOString()}</time>
  <author>
    <name>${appmetadata["name"]} v${appmetadata["version"]}</name>
    <link href="https://banglejs.com/apps/?id=rockclimb" />
  </author>
</metadata>
${tracks.join('\n')}
</gpx>`;
    }

    /**
     * @param {String} filename
     * @returns {Promise<string|null>}
     */
    async function buildTrkFromFile(filename, trackNo) {
        const metadata = files[filename];
        if (!csvs[filename]) {
            csvs[filename] = await new Promise(resolve => Util.readStorageFile(filename.replace('.json', '.csv'), resolve));
        }
        const trkpts = buildTrkpts(csvs[filename], metadata.start);
        return buildTrk(filename, metadata, trkpts, trackNo);
    }

    /**
     * @param {String} session
     * @param {String[]} sessionfiles
     * @returns {Promise<void>}
     */
    async function downloadSession(session, sessionfiles) {
        const tracks = [];
        let trackNo = 1;
        try {
            Util.showModal("Downloading...");
            for (const filename of sessionfiles) {
                try {
                    Util.showModal(`Downloading (${trackNo}/${sessionfiles.length})...`);
                    const trk = await buildTrkFromFile(filename, trackNo++);
                    tracks.push(trk);
                } catch (err) {
                    throw new Error(`Failed to generate track for file '${filename}' - ${err.message}`);
                }
            }
            Util.saveFile(`rockclimb.${session}.gpx`, "gpx/xml", wrapGpx(tracks));
            Util.hideModal();
        } catch (err) {
            Util.showModal(`Error downloading session '${session}' - ${err.message}`, "Error");
        }
    }

    /**
     * @param {String} filename
     * @returns {Promise<void>}
     */
    async function downloadData(filename) {
        try {
            Util.showModal("Downloading...");
            const trk = await buildTrkFromFile(filename, 1);
            Util.saveFile(filename.replace('.json', '.gpx'), "gpx/xml", wrapGpx([trk]));
            Util.hideModal();
        } catch (err) {
            Util.showModal(`Error downloading file '${filename}' - ${err.message}`, "Error");
        }
    }

    /**
     * @param {String} filename
     * @returns {Promise<void>}
     */
    async function deleteData(filename) {
        await new Promise(resolve => Util.eraseStorage(filename, resolve));
        await new Promise(resolve => Util.eraseStorageFile(filename.replace('.json', '.csv'), resolve));
    }

    function elapsedString(ms) {
        const s = (ms / 1000) | 0;
        return `${((s / 60) | 0).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    }

    function getTags(metadata) {
        const tags = [];
        if (metadata.type !== 'Normal') {
            tags.push(metadata.type);
        }
        if (metadata.weighted) {
            tags.push("Weighted");
        }
        if (metadata.autoBelay) {
            tags.push("Auto Belay");
        }
        if (metadata.climbDown) {
            tags.push("Climb Down");
        }
        return tags;
    }

}
