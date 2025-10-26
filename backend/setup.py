from setuptools import setup, find_packages

setup(
    name="hack-babies-backend",
    version="0.1.0",
    description="Hack Babies 2.0 Backend Components",
    author="AbhinavDShetty",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "mcp>=1.18.0",
        "python-dotenv>=1.1.1",
        "django>=4.2.0",
        "requests>=2.31.0",
    ],
    extras_require={
        'mcp-client': [
            "mcp>=1.18.0",
            "python-dotenv>=1.1.1",
        ],
        'chemical-backend': [
            "django>=4.2.0",
            "requests>=2.31.0",
            "python-dotenv>=1.1.1",
        ],
        'blender-mcp': [
            "mcp>=1.18.0",
            "python-dotenv>=1.1.1",
        ]
    }
)