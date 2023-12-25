const createElement = (className, tagName = 'div') => {
	const elem = document.createElement(tagName);
	if (className) elem.className = className;
	return elem;
};

const createMapToIndices = (arr) =>
	arr.reduce((acc, val, index) => {
		if (acc[val] !== undefined) return acc;
		acc[val] = index;
		return acc;
	}, {});

// constants
const QUALITY = {
	MAJ: 'major',
	MIN: 'minor',
	AUG: 'augmented',
	DIM: 'diminished',
	DOM: 'dominant',
};

// from https://en.wikiversity.org/wiki/Template:Music_symbols
const UNICODE = {
	FLAT: '&#x266d;',
	NATURAL: '&#x266e;',
	SHARP: '&#x266f;',
};

const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteToIndexMap = createMapToIndices(notes);

const components = [
	'P1',
	'm2',
	'M2',
	'm3',
	'M3',
	'P4',
	'd5',
	'P5',
	'A5',
	'M6',
	'm7',
	'M7',
];

const componentToIndexMap = createMapToIndices(components);
componentToIndexMap['d7'] = componentToIndexMap['M6'];

const computeOffsets = (scaleSteps) => {
	let accOffset = 0;
	return scaleSteps.map((offset) => {
		const start = accOffset;
		accOffset += offset;
		return start;
	});
};

const majorScaleSteps = [2, 2, 1, 2, 2, 2, 1];
const majorScaleOffsets = computeOffsets(majorScaleSteps);

const minorScaleSteps = [2, 1, 2, 2, 1, 2, 2];
const minorScaleOffsets = computeOffsets(minorScaleSteps);

const getFrequency = (octave, noteIndex) =>
	27.5 * Math.pow(2, octave) * Math.pow(2, (noteIndex - 9) / 12);

// playback
let playing = [];

const stopAllNotes = () => {
	playing.forEach((osc) => osc.stop());
	playing = [];
};

const audioContext = new AudioContext();

const playSound = (frequency, options) => {
	const { gainValue = 1, pan = 0, when = 0, length = 1e3 } = options ?? {};

	console.log(
		`Playing ${frequency.toFixed(2)} Hz (gain: ${gainValue.toFixed(
			2,
		)}, pan: ${pan.toFixed(2)}, when: ${when.toFixed(2)})`,
	);

	const panner = audioContext.createPanner();
	panner.panningModel = 'equalpower';
	panner.setPosition(pan, 0, 0);
	panner.connect(audioContext.destination);

	const gainNode = audioContext.createGain();
	gainNode.gain.value = gainValue;
	gainNode.connect(panner);

	const oscillator = audioContext.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;

	// connect the gainNode
	oscillator.connect(gainNode);
	gainNode.gain.value = gainValue;

	const play = (when) => {
		oscillator.start(when);

		playing.push(oscillator);

		setTimeout(() => {
			gainNode.gain.value = 0;
		}, length - 50);

		setTimeout(() => {
			playing = playing.filter((osc) => osc !== oscillator);
			oscillator.stop();
		}, length);
	};

	play(when);
};

const CHORD_STYLE = {
	SOLID: 'Solid',
	BROKEN_SUSTAINED: 'Broken',
	BROKEN: 'Broken (Individual Notes)',
};

const playChord = (chordType, ...freqs) => {
	console.log('Playing chord');
	const gainValue = 1 / freqs.length;
	const length =
		1e3 +
		(chordType === CHORD_STYLE.BROKEN_SUSTAINED ? 300 * freqs.length : 0);

	freqs.forEach((freq, i) => {
		const when =
			chordType === CHORD_STYLE.BROKEN_SUSTAINED
				? audioContext.currentTime + (300 * i) / 1e3
				: 0;

		playSound(freq, {
			gainValue,
			pan: (2 / freqs.length) * i + 1 - 2,
			when,
			length,
		});
	});

	return length;
};

// TODO: rename to symbolize "generic" chord (ie not in a key)
const generateChord = (text = 'I') => {
	const degree = text.match(/[IViv]+/)[0];

	const stackedInterval = +text.match(/\d+/g)?.[0] || undefined;

	// The order here matters!
	let qualityExplicit = false;
	let quality = degree === degree.toUpperCase() ? QUALITY.MAJ : QUALITY.MIN;
	if (stackedInterval >= 7) {
		quality = QUALITY.DOM;
		qualityExplicit = true;
	}
	if (text.match(/\+/)) {
		quality = QUALITY.AUG;
		qualityExplicit = true;
	}
	if (text.match(/M/)) {
		quality = QUALITY.MAJ;
		qualityExplicit = true;
	}
	if (text.match(/m/)) {
		quality = QUALITY.MIN;
		qualityExplicit = true;
	}
	if (text.match(/dim/)) {
		quality = QUALITY.DIM;
		qualityExplicit = true;
	}

	const omit5 = text.match(/no5/);

	const restOfName = text.replace(degree, '');

	let degreeIndex;
	switch (degree.toLowerCase()) {
		case 'i':
			degreeIndex = 0;
			break;
		case 'ii':
			degreeIndex = 1;
			break;
		case 'iii':
			degreeIndex = 2;
			break;
		case 'iv':
			degreeIndex = 3;
			break;
		case 'v':
			degreeIndex = 4;
			break;
		case 'vi':
			degreeIndex = 5;
			break;
		case 'vii':
			degreeIndex = 6;
			break;
		default:
			throw new Error();
	}

	const chord = {
		rawInput: text,
		degree,
		degreeIndex,
		omit5,
		quality,
		inversion: 0,
		inversionShift: 0,
		qualityExplicit,
		stackedInterval,
		setHTML: (div, key) => {
			div.innerHTML = '';
			div.textContent = key
				? notes[
						(majorScaleOffsets[chord.degreeIndex] +
							noteToIndexMap[key]) %
							12
				  ]
				: chord.degree;

			const span = createElement(undefined, 'span');
			span.textContent = '';

			if (chord.qualityExplicit) {
				switch (chord.quality) {
					case QUALITY.MAJ:
						span.textContent += 'Δ';
						break;
					case QUALITY.MIN:
						span.textContent += 'm';
						break;
					case QUALITY.AUG:
						span.textContent += '+';
						break;
					case QUALITY.DIM:
						span.textContent += 'dim';
						break;
					case QUALITY.DOM:
						// nothing
						break;
				}
			} else {
				if (key && chord.quality === QUALITY.MIN) {
					span.textContent += 'm';
				}
			}

			if (chord.stackedInterval)
				span.textContent += chord.stackedInterval;

			div.append(span);
		},
		getNotes: (key = 'C') => {
			const keyIndex = noteToIndexMap[key];

			const rawOffsets = new Set([1, 3, 5]);

			if (chord.omit5) {
				rawOffsets.delete(5);
			}

			const additionalOffsets = [];

			if (chord.stackedInterval) {
				additionalOffsets.push(chord.stackedInterval);
				for (let o = +chord.stackedInterval - 2; o > 5; o -= 2) {
					additionalOffsets.push(o);
				}
			}

			additionalOffsets.sort();
			additionalOffsets.forEach((o) => rawOffsets.add(o));

			const tempOffsets = Array.from(rawOffsets)
				.map((v) => v - 1)
				.sort((a, b) => +a - +b);

			const noteOffsets = tempOffsets
				.map(
					(v) =>
						majorScaleOffsets[v % majorScaleOffsets.length] +
						Math.floor(v / majorScaleOffsets.length) * 12,
				)
				.map((v) => v + majorScaleOffsets[chord.degreeIndex]);

			switch (quality) {
				case QUALITY.MAJ: {
					// do nothing
					break;
				}

				case QUALITY.MIN: {
					--noteOffsets[1];
					break;
				}

				case QUALITY.AUG: {
					if (chord.omit5) {
						++noteOffsets[1];
					} else {
						++noteOffsets[2];
					}
					break;
				}

				case QUALITY.DIM: {
					if (chord.omit5) {
						--noteOffsets[1];
					} else {
						--noteOffsets[1];
						--noteOffsets[2];
					}
					break;
				}

				case QUALITY.DOM: {
					if (chord.omit5) {
						--noteOffsets[2];
					} else {
						--noteOffsets[3];
					}
				}
			}

			const chordNotes = noteOffsets.map((o) => o + keyIndex);

			// do the inversion
			if (chord.inversion) {
				// NOTE: this only works for triads atm
				for (let i = 0; i < chord.inversion; ++i) {
					const note = chordNotes.shift();
					chordNotes.push(note + 12);
				}

				for (let i = 0; i < chordNotes.length; ++i) {
					chordNotes[i] += chord.inversionShift * 12;
				}
			}

			return chordNotes;
		},
	};

	return chord;
};
