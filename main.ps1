$global:data_robot = "data\robot.json"
$global:data_schedule = "data\schedule.json"
$global:data_job = "data\job.json"
$global:data_span = "data\span.json"
$global:config_file = "config.json"

try {
    $global:config = Get-Content "$config_file" -Raw -ErrorAction:SilentlyContinue -WarningAction:SilentlyContinue | ConvertFrom-Json -ErrorAction:SilentlyContinue -WarningAction:SilentlyContinue
} catch {
    Write-Host "The configuration file is missing!"
    exit 1
}

$bodyAccount = @{
	"tenancyName" = $config.Orchestrator.tenant
	"usernameOrEmailAddress" = $config.Orchestrator.username
	"password" = $config.Orchestrator.password
} | ConvertTo-Json

$authUri = $config.Orchestrator.url + "/api/account/authenticate"
$contentType = "application/json;charset=utf-8"

$resAccount = Invoke-RestMethod -Uri $authUri -Method Post -Body $bodyAccount -ContentType $contentType

# Login success or fail
if ($resAccount.success -eq "True"){
	Write-Host "Orchestrator Login success"
	$authKey = $resAccount.result
	$headers = @{"Authorization"="Bearer $authKey"}	
} else {
	Write-Host "ERROR: Orchestrator Login failed"
	exit 1
}

$robotUri = $config.Orchestrator.url + "/odata/Robots"
$resRobot = Invoke-RestMethod -Uri $robotUri -Method Get -ContentType $contentType -Headers $headers

$robotJson = $resRobot.value | ConvertTo-Json
$robotString = "global_robot_list = " + $robotJson

Set-Content -Path $data_robot -Value $robotString -Encoding UTF8

Write-Host "Saved Robot Data to $data_robot"

$scheduleUri = $config.Orchestrator.url + "/odata/ProcessSchedules"
$resSchedule = Invoke-RestMethod -Uri $scheduleUri -Method Get -ContentType $contentType -Headers $headers

$scheduleJson = $resSchedule.value | ConvertTo-Json
$scheduleString = "global_schedule_list = " +  $scheduleJson

Set-Content -Path $data_schedule -Value $scheduleString -Encoding UTF8

Write-Host "Saved Schedule Data to $data_schedule"

$jobUri = $config.Orchestrator.url + "/odata/Jobs"
$resJob = Invoke-RestMethod -Uri $jobUri -Method Get -ContentType $contentType -Headers $headers

$jobJson = $resJob.value | ConvertTo-Json
$jobString = "global_job_list = " + $jobJson

Set-Content -Path $data_job -Value $jobString -Encoding UTF8

Write-Host "Saved Job Data to $data_job"

$timeSpanStart = "global_span_start = '" + $config.TimeSpan.Start + "';"
$timeSpanEnd = "global_span_end = '" + $config.TimeSpan.End + "';"
Set-Content -Path $data_span -Value $timeSpanStart
Add-Content -Path $data_span -Value $timeSpanEnd

Write-Host "Please Open index.html at browser!"