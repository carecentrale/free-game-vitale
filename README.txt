Build tools for Adventurers of Drenerics (moved here from the game folder on 17 Nov 2026)

These files build the Android app and send it to Google Play. They are not part of the game,
so they live here and not in Desktop\adventurers-of-drenerics-game or on GitHub.
The game folder holds only the game, its tests and its documents.

  build-watcher.ps1            the background helper that runs builds (Windows task "Drenerics build watcher")
  install-build-watcher.bat    install or reinstall the watcher      remove-build-watcher.bat   remove it
  build-android*.bat           build by hand (double-click): with or without tests, with or without upload
  build-android.ps1            the build itself          upload-play.mjs   the upload to Google Play
  check-play-key.bat           checks the Play key, uploads nothing
  update-game.bat              gets the latest game from GitHub into the game folder
  github-sign-in.bat           one-time GitHub sign-in for pushes
  machine-status.ps1           report on this PC ("status" request)
  save-tools.ps1               saves these files to the branch "build-tools" of the game's GitHub repository
  remote-build.sh              asks for a build from anywhere through GitHub (run it in any clone that can push)
  serve-local.mjs              local test server: serves the game folder's www (read only) to this PC and the home Wi-Fi
  start-local-test.bat         starts it (double-click): play the game before any push. Close the window to stop it.
                               Uses port 8080. Added 18 Nov 2026. Not part of the build; nothing is pushed or built.
  tests\                       tests for upload-play.mjs and serve-local.mjs (run: node --test tests\serve-local.test.mjs)

  build-requests\              write one word into request.txt to ask for a build; status and logs are here
  build-android-work\          the build's work folder (safe to delete; it is made again)
  releases\                    the built app files (.aab). Kept: the last 10 builds, plus the last build of every month.

Version history: these files are saved on the branch "build-tools" of the game's GitHub repository
(not on main, so they are not in the game folder). After changing a file here, run save-tools.ps1.
Older versions, up to 17 Nov 2026, are in the main branch's history (last in commit efd5f65).
