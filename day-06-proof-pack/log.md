# Day 6 log: Proof Pack

Notes from the build, 2 November 2026.

- Competition is real (Snap&Drive, HandProof), so the difference had to be the forced checklist, the fingerprints and one shareable PDF, plus a move-in checklist for tenants that the car apps don't have.
- Used the system camera through `TakePicture` and a FileProvider instead of CameraX. That means no camera permission, a smaller APK, and the phone's best camera app.
- The camera app can push Proof Pack out of memory, so the shot being taken is saved in the instance state and picked up again on return.
- Fingerprint = SHA-256 of the original JPEG, computed right after capture. The PDF uses downscaled, rotation-corrected copies and never touches the originals.
- Location: the last fix under 10 minutes old, from any enabled provider. No waiting, and no Play Services dependency.
- Built first time: 4 unit tests pass, and the release APK is 1.3 MB.

## Still to do with a real person

- Walk round a real car (or a friend's) with it, then make and open the PDF on camera.
- Do the move-in checklist in a real flat with the tenant.
