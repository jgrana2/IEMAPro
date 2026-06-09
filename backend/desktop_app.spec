# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ["desktop_app.py"],
    pathex=[".."],
    binaries=[],
    datas=[("../dist/public", "dist/public")],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ECG Monitor",
    console=False,
    strip=False,
    upx=True,
    runtime_tmpdir=None,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="ECG Monitor",
)

app = BUNDLE(
    coll,
    name="ECG Monitor.app",
    info_plist={
        "NSBluetoothAlwaysUsageDescription": "ECG Monitor needs Bluetooth access to scan for and connect to ECG devices.",
        "NSBluetoothPeripheralUsageDescription": "ECG Monitor needs Bluetooth access to scan for and connect to ECG devices.",
    },
)
