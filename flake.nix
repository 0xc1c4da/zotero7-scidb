{
  description = "A Nix-flake-based Node and Zotero 7 development environment";

  # GitHub URLs for the Nix inputs we're using
  inputs = {
    # Simply the greatest package repository on the planet
    nixpkgs.url = "github:NixOS/nixpkgs";
    # A set of helper functions for using flakes
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };    

        node = pkgs.nodejs_latest;
        zotero = pkgs.zotero-beta;
      in {
        devShells = {
          default = pkgs.mkShell {
            # Packages included in the environment
            buildInputs = [ node zotero ];

            # Run when the shell is started up
            shellHook = ''
              echo "node `${node}/bin/node --version`"
              echo "zotero `${zotero}/bin/zotero --version`"

              rm .env
              echo "ZOTERO_PLUGIN_ZOTERO_BIN_PATH=${zotero}/bin/zotero" > .env
              echo "ZOTERO_PLUGIN_PROFILE_PATH=$(ls ~/.zotero/zotero/ | grep '\.default$' | xargs -I {} echo ~/.zotero/zotero/{})" >> .env
              echo "ZOTERO_PLUGIN_DATA_DIR=" >> .env
            '';
          };
        };
      });
}
