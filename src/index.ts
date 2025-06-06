import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the galaxy extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'galaxy:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension galaxy is activated!');
  }
};

export default plugin;
