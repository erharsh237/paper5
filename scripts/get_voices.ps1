Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($v in $s.GetInstalledVoices()) {
    Write-Host "$($v.VoiceInfo.Name) | $($v.VoiceInfo.Gender) | $($v.VoiceInfo.Culture)"
}
