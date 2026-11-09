import { clearBackdrop } from '../components/backdrop/backdrop';
import { renderComponent } from '../utils/reactUtils';
import { setYouTubeTabActive } from '../utils/youtube';

/** The YouTube home tab: a React view (linking, the grid, search) in the tab's content. */
class YouTubeTab {
    constructor(view) {
        this.view = view;
    }

    onResume() {
        setYouTubeTabActive(true);
        clearBackdrop();
        if (!this.unmount) {
            return import('../components/youtube/YouTubeHome').then(({ default: YouTubeHome }) => {
                this.unmount = renderComponent(YouTubeHome, {}, this.view.querySelector('.sections'));
            });
        }
        return Promise.resolve();
    }

    onPause() {
        setYouTubeTabActive(false);
    }

    destroy() {
        setYouTubeTabActive(false);
        this.unmount?.();
        this.unmount = null;
        this.view = null;
    }
}

export default YouTubeTab;
