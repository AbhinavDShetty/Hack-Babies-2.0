# Setup script for Hack Babies 2.0 backend components
Write-Host "Setting up virtual environments for Hack Babies 2.0 backend..." -ForegroundColor Green

# Function to create and setup venv
function Setup-Component {
    param (
        [string]$componentPath,
        [string]$componentName
    )
    
    Write-Host "`nSetting up $componentName..." -ForegroundColor Cyan
    Set-Location $componentPath
    
    # Create venv if it doesn't exist
    if (-not (Test-Path "venv")) {
        python -m venv venv
        Write-Host "Created virtual environment for $componentName"
    }
    
    # Activate venv and install requirements
    .\venv\Scripts\Activate.ps1
    if (Test-Path "requirements.txt") {
        python -m pip install -r requirements.txt
        Write-Host "Installed requirements for $componentName"
    }
    deactivate
}

# Get the script's directory (backend folder)
$backendPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Setup each component
Setup-Component "$backendPath\clients\mcp-client" "MCP Client"
Setup-Component "$backendPath\chemical_backend" "Chemical Backend"
Setup-Component "$backendPath\blender-mcp-main" "Blender MCP"

Write-Host "`nSetup complete! To activate a specific environment:" -ForegroundColor Green
Write-Host "1. cd into the component directory"
Write-Host "2. Run: .\venv\Scripts\Activate.ps1"
Write-Host "3. Run the component (see README.md for specific instructions)"