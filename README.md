# Declare: This tool is orginially designed and developed by Stanley to help specific client. It is not a UiPath product, and couldn't garentee its quality and maintenance in long run.

Scheduler visualizer is a tool to visualize UiPath Orchestrator's schedulers and jobs.
By visualizing schedulers and jobs, people can know clearly the usage of resources in robots, and decide how to optimize resources.

Requirements:
- Powershell 5.0(win10)
- Browser(Chrome is recommended)

How to use:
1. input config.json
Input contents in config.json.
OC information and Time Span are must, Filter is optional.

2. execute main.ps1
Execute main.ps1 with powershell. Maybe ExecutionPolicy should be changed to bypass in advance.

3. Open index.html
Open index.html in browser.


