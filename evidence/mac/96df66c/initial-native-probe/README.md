# Initial native probe failure

Original driver `370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9`
failed after **20.330 seconds**, before requesting a capture. All eight cleanup checks pass.
The joint native-window assertion tested foreground/PID/bounds/appearance; its failed sample
was not retained, so the original failing conjunct is unknown.

A separate explicit-light diagnostic retains the same foreground PID and 960×640 window.
Swift `UserDefaults.standard` reports dark while System Events reports `false` and
`defaults read -g AppleInterfaceStyle` returns absent. This establishes conflicting appearance
readbacks, not retrospective proof of the original conjunct. OS appearance returned to dark.

The collector correction reads actual System Events appearance and retains native samples
before assertions. Application ASAR stays
`b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44`.
Fresh-profile confirmation is separate. This failed run remains failed, with zero images.
