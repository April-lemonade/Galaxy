import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker,
  ToolbarButton
} from '@jupyterlab/apputils';

import { IFileBrowserFactory, FileBrowser } from '@jupyterlab/filebrowser';
import { SankeyWidget } from './components/SankeyWidget';
import { PageConfig } from '@jupyterlab/coreutils';
import { runIcon } from '@jupyterlab/ui-components';


function getXsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/\b_xsrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  browserFactory: IFileBrowserFactory,
  restorer: ILayoutRestorer | null
) {
  console.log('✅ JupyterLab extension galaxy is activated!');

  const command = 'galaxy:analyze';

  app.commands.addCommand(command, {
    label: 'Analyze Selected Notebooks',
    execute: async () => {
      const fileBrowserWidget = browserFactory.tracker.currentWidget;
      if (!fileBrowserWidget) {
        console.warn('⚠️ No active file browser');
        return;
      }

      const selectedPaths = Array.from(fileBrowserWidget.selectedItems())
        .filter(item => item.type === 'notebook')
        .map(item => item.path);

      console.log("📁 Selected paths to send:", selectedPaths);

      if (selectedPaths.length === 0) {
        console.warn('⚠️ No notebooks selected');
        return;
      }

      try {
        const xsrfToken = getXsrfTokenFromCookie();
        const url = PageConfig.getBaseUrl() + 'galaxy/analyze';
        console.log("XSRF TOKEN", xsrfToken);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-XSRFToken': xsrfToken || ''
          },
          credentials: 'same-origin',
          body: JSON.stringify({ paths: selectedPaths })
        });

        if (!res.ok) throw new Error(`❌ ${res.statusText}`);
        const result = await res.json();

        const content = new SankeyWidget(result);
        const widget = new MainAreaWidget({ content });
        widget.title.label = 'Sankey Diagram';
        widget.title.closable = true;
        app.shell.add(widget, 'main');
        tracker.add(widget);
      } catch (err) {
        console.error('❌ Failed to analyze notebooks:', err);
      }
    }
  });

  palette.addItem({ command: command, category: 'Galaxy Tools' });


  // Tracker + restore
  const tracker = new WidgetTracker<MainAreaWidget<SankeyWidget>>({
    namespace: 'galaxy'
  });

  if (restorer) {
    restorer.restore(tracker, {
      command,
      name: () => 'galaxy'
    });
  }

  app.restored.then(() => {
    // 添加 "Analyze" 按钮到 FileBrowser 工具栏
    const fbWidget = browserFactory.tracker.currentWidget;
    if (fbWidget && fbWidget instanceof FileBrowser) {
      const analyzeButton = new ToolbarButton({
        icon: runIcon,
        tooltip: 'Analyze selected notebooks',
        onClick: () => {
          app.commands.execute(command);
        }
      });
      fbWidget.toolbar.insertItem(5, 'analyzeNotebooks', analyzeButton);
    }
  })
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'galaxy:plugin',
  description: 'Analyze selected notebooks and show Sankey diagram.',
  autoStart: true,
  requires: [ICommandPalette, IFileBrowserFactory],
  optional: [ILayoutRestorer],
  activate
};

export default plugin;