# __import__("setuptools").setup()

from setuptools import setup, find_packages

setup(
    name="galaxy",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=["jupyter_server"],
    entry_points={"jupyter_serverextension": ["galaxy = galaxy"]},
)
