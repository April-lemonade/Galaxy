# galaxy/handlers.py
import os
import json
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

class FinalFileHandler(APIHandler):
    def get(self):
        file_path = os.path.join(os.path.dirname(__file__), "data", "final_file.json")
        if not os.path.exists(file_path):
            self.set_status(404)
            self.finish(json.dumps({"error": "file not found"}))
            return
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.set_header('Content-Type', 'application/json')
        self.finish(data)

def setup_handlers(web_app):
    route_pattern = url_path_join(web_app.settings['base_url'], 'galaxy', 'final_file')
    web_app.add_handlers('.*$', [(route_pattern, FinalFileHandler)])