# Zotero 7 SciDB Downloader

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

This is an plugin for Zotero 7 that enables automatic download of PDFs for items with a DOI from Scihub or SciDB.

It aims to be a Zotero 7 compatible version of [ethanwillis/zotero-scihub](https://github.com/ethanwillis/zotero-scihub/).

## Quick Start Guide

### Install

- Download the latest release (.xpi file) from the Releases Page Note If you're using Firefox as your browser, right click the xpi and select "Save As.."
- In Zotero click "Tools" in the top menu bar and then click "Plugins     "
- On the "Manage Your Plugins" page, click the gear icon in the top right.
- Select Install Plugin from file.
- Browse to where you downloaded the .xpi file and select it.
- Restart Zotero, by clicking "restart now" in the extensions list where the scihub plugin is now listed.

### Usage
Once you have the plugin installed simply, right click any item in your collections. There will now be a new context menu option titled "Download from SciDB" 

Once you click this, a PDF of the file will be downloaded from SciDB and attached to your item in Zotero.

### Settings

In Zotero Settings there is a SciDB Downloader pane that will allow you to change your endpoint.


## Development

- `nix develop`
- `npm install`
- `npm start`

## Build

- `npm run build`