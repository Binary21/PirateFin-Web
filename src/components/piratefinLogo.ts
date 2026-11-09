import pLogoUrl from 'assets/img/piratefin-p.png';

/**
 * The PirateFin logo: the "P" (a P with a cassette and crossbones) followed by the rest of the name.
 */

// The red of the "P" artwork, so the name matches it.
const RED = '#e41513';

// The P artwork is 308 x 360; drawn 120 units tall.
const P_HEIGHT = 120;
const P_WIDTH = Math.round((308 / 360) * P_HEIGHT * 10) / 10;

// "IRATEFIN" in Arial Black at 166 units, squeezed to 470 wide, baseline at y = 0. Drawn as outlines so it looks
// the same on TVs, which don't have the font and would substitute a thin one.
const NAME_PATH = 'M7.3 -118.8H27V0H7.3ZM41.4 0V-118.8H74.3Q83.4 -118.8 88.2 -115.9Q93 -113 96 -105.1Q99 -97.2 99 -85.8Q99 -75.9 96.7 -68.8Q94.4 -61.6 90.5 -57.1Q88 -54.3 83.6 -52.4Q87.1 -50.3 88.7 -48.1Q89.8 -46.6 91.8 -41.8Q93.9 -37 94.6 -34.4L104.1 0H81.9L71.3 -36.3Q69.3 -43.4 67.8 -45.5Q65.7 -48.2 63 -48.2H61.2V0ZM61.2 -70.7H69.5Q70.9 -70.7 74.7 -72.3Q76.7 -73 77.9 -76Q79.2 -79 79.2 -82.9Q79.2 -88.7 77.2 -91.8Q75.3 -94.8 69.9 -94.8H61.2ZM149.7 -19.6H127.2L124.1 0H104L128 -118.8H149.4L173.4 0H152.8ZM145.5 -45.3 138.5 -88 131.5 -45.3ZM175.2 -118.8H235.1V-89.5H215V0H195.3V-89.5H175.2ZM244 -118.8H296.7V-93.5H263.7V-74.6H294.3V-50.3H263.7V-26.9H297.7V0H244ZM308.4 -118.8H357.1V-93.3H328.2V-72.5H352.9V-48.6H328.2V0H308.4ZM368.5 -118.8H388.2V0H368.5ZM402.5 -118.8H420.9L444.9 -53.1V-118.8H463.4V0H444.9L421 -65.2V0H402.5Z';

const P_IMAGE = `<image href="${pLogoUrl}" x="0" y="0" width="${P_WIDTH}" height="${P_HEIGHT}"/>`;

/**
 * Gets the logo as inline SVG markup.
 * @param withName Whether to follow the P with "IRATEFIN".
 * @returns The SVG markup.
 */
export function getPirateFinLogoSvg(withName = true): string {
    if (!withName) {
        return `<svg class="pfLogo pfLogo-flag" viewBox="0 0 ${P_WIDTH} ${P_HEIGHT}" role="img" aria-label="PirateFin">${P_IMAGE}</svg>`;
    }

    const textX = P_WIDTH + 6;
    const textLength = 470;
    return `<svg class="pfLogo" viewBox="0 0 ${textX + textLength + 4} ${P_HEIGHT}" role="img" aria-label="PirateFin">
        ${P_IMAGE}
        <path transform="translate(${textX} ${P_HEIGHT})" fill="${RED}" d="${NAME_PATH}"/>
    </svg>`;
}
