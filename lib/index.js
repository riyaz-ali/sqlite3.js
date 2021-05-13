import * as Comlink from 'comlink';
export default Comlink.wrap(new Worker('./worker/index.js'));