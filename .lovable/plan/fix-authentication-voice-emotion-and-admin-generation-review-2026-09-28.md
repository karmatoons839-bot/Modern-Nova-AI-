# Fix authentication, voice emotion, and admin generation review

## Authentication
- Keep Google and email/password on the same existing Lovable Cloud project.
- Make the sign-in screen distinguish Google-only accounts from password accounts instead of reporting every case as a generic bad password.
- Keep confirmation-required signup handling explicit and add a safe path to resend confirmation or set/reset a password.
- Test a fresh website signup, confirm its auth identity exists, complete confirmation in the test environment, log out, log back in, refresh, and verify a wrong password fails.

## Voice emotion and realism
- Keep emotion attached to each analyzed story line and display it directly with that line after Emotion Add.
- Strengthen the server-side performance directions so the selected single emotion is audible while only the original dialogue is spoken.
- Verify the browser sends the locked emotion and the speech endpoint receives it unchanged.

## Admin generation review
- Preserve each generation's user email, prompt/story line, emotion/style, status, and stored output.
- Save generated voice audio securely, as images already are, so the admin can play or download it.
- Extend the protected admin Generations view with secure temporary output links for voice, image, and thumbnail results.
- Add completion notifications containing the user email and safe prompt details, without exposing credentials.

## Validation
- Check the current build, authentication responses, session persistence, wrong-password behavior, voice generation, and admin-only access end to end.
