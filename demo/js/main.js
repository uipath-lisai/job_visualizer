$(document).ready(function(){
    var main = function(){
        //group_example();
        real_example("2019-06-10 00:00:00", "2019-06-10 23:59:59");
    }
    
    var real_example = function(span_start, span_end){
        // Should define local var.
        in_out = {
            index: 0,
            groups: [],
            items: []
        };
        
        robot_entry(in_out, span_start, span_end);
        
        schedule_entry(in_out, span_start, span_end);

        job_entry(in_out, span_start, span_end);
        
        render_group_content(in_out.groups);

        
        var vis_groups = new vis.DataSet(in_out.groups);
        var vis_items = new vis.DataSet(in_out.items);
        var container = document.getElementById('visualization');

        var options = {
            editable: false,   // default for all items
            horizontalScroll: false,
            orientation: 'both',
            tooltip: {overflowMethod: 'cap'}
        };
        new vis.Timeline(container, vis_items, vis_groups, options);
    };
    
    var robot_entry = function(params, span_start, span_end){
        var total_minutes = span_total_minutes(span_start, span_end);
        
        robot_raw_data().filter(function(value){
            return value.RobotEnvironments !== "" && value.Type === "Unattended";
        }).forEach(function(robot){
            params.index++;
            params.groups.push({
                id: params.index,
                machine_name: robot.MachineName,
                environments: robot.RobotEnvironments.split(","),
                robot_name: robot.Name,
                is_alive: true,
                total_minutes: total_minutes,
                used_minutes: 0
            });
        });
    };
    
    var job_entry = function(params, span_start, span_end){
        var job_data = jobs_raw_data().filter(function(value){
            var condition_type = value.SourceType === "Schedule"; // start by schedule
            if("Pending" === value.State){
                value.StartTime = value.CreationTime;
                value.EndTime = span_end;
            }
            var condition_time = verify_date(new Date(value.StartTime), span_start, span_end) || verify_date(new Date(value.EndTime), span_start, span_end);
            return condition_type && condition_time;
        });
                
        var machine_groups = {}; // MachineName : [origin_obj]
        job_data.forEach(function(value){
            if(value.HostMachineName in machine_groups){
                // add job to the found group
                machine_groups[value.HostMachineName].push(value);
            }else{
                machine_groups[value.HostMachineName] = [value];
            }
        });
        
        
        for(var key in machine_groups){
            //params.index++;            
            var jobs_arr = machine_groups[key];
            var machine_match = params.groups.filter(function(group){
                return key === group.machine_name;
            });

            var group_id;
            if(machine_match.length == 0){
                // Robot doesn't exists
                params.index++;
                params.groups.push({
                    id: params.index,
                    content: key,
                    title: "RobotName: UnKnown,\r\nMachineName: " + key,
                    is_alive: false
                });
                group_id = params.index;
            }else{
                machine_match.forEach(function(group){
                    // Add job to group.
                    // Warn: this is not correct for high-density robot
                    group_id = group.id;
                });
            }
            
            jobs_arr.forEach(function(job){
                params.items.push({
                    content: job.ReleaseName,
                    title: "Name: " + job.ReleaseName + ",<br>Status: " + job.State,
                    type: 'range',
                    start: job.StartTime,
                    end: job.EndTime,
                    className: job_class(job.State),
                    group: group_id
                });
                plus_usage(group_id, params.groups, job);
            });  
        }
    };
    

    var schedule_entry = function(params, span_start, span_end){
        var schedule_data = $.grep(schedule_raw_data(), function(value){
            return value.Enabled === true;
        });

        var env_schedules = {}; // {envName: {envId: 1, envName: a, schedules: [{cron:}]}}
        schedule_data.forEach(function(value){
            if(value.EnvironmentName in env_schedules){
                // add schedule to the found environment
                var env_schedule = env_schedules[value.EnvironmentName];
                env_schedule.schedules.push({
                    schedule_cron: value.StartProcessCron,
                    schedule_name: value.Name,
                    is_schedule_minutely: JSON.parse(value.StartProcessCronDetails).type == 0,
                    schedule_summary: value.StartProcessCronSummary,
                    environment_name: value.EnvironmentName,
                    package: value.PackageName,
                    release_name: value.ReleaseName
                });
            }else{
                env_schedules[value.EnvironmentName] = {
                    content: value.EnvironmentName,
                    envId: value.EnvironmentId,
                    schedules:[{
                        schedule_cron: value.StartProcessCron,
                        schedule_name: value.Name,
                        is_schedule_minutely: JSON.parse(value.StartProcessCronDetails).type == 0,
                        schedule_summary: value.StartProcessCronSummary,
                        environment_name: value.EnvironmentName,
                        package: value.PackageName,
                        release_name: value.ReleaseName
                    }]
                };
            }
        });
                
        for(var env_name in env_schedules){
            var schedule_obj = env_schedules[env_name];

            // Find group id for environment
            var group_ids = params.groups.filter(function(group){
                return group.environments.includes(env_name);
            }).map(function(group){
                return group.id;
            });
            
            group_ids.forEach(function(id){
                schedule_obj.schedules.forEach(function(cron){
                    if(cron.is_schedule_minutely){
                        params.items.push({
                           content: "", 
                           title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Start: " + cron.schedule_summary,
                           type: 'range', 
                           start: span_start,
                           end: span_end,
                           className: 'schedule_item',
                           group: id
                        });
                    }else{
                        var start_times = schedule_start_time(cron.schedule_cron, span_start, span_end);
                        start_times.forEach(function(starts){
                            params.items.push({
                               content: "", // content is meaningless here
                               title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Start: " + starts,
                               type: 'point', 
                               start: starts,
                               className: 'schedule_item',
                               group: id
                            });
                        });    
                    }
                });                
            });
        }
    };
    
    // return array of Dates
    var schedule_start_time = function(cron, span_start, span_end){
        // second, minute, hour, day, month, dayofweek, year
        var cron_arr = cron.split(" ");
        var cron_schedule = {
            minute: schedule_expand("minute", cron_arr[1]),
            hour: schedule_expand("hour", cron_arr[2]),
            day: schedule_expand("day", cron_arr[3]),
            month: schedule_expand("month", cron_arr[4]),
            dayofweek: schedule_expand("dayofweek", convert_number(cron_arr[5])),
            year: range(Number(span_start.split("-")[0]), Number(span_end.split("-")[0]), 1)
        };
        
        return good_dates(cron_schedule, span_start, span_end);
    };
    
    var good_dates = function(cron_schedule, span_start, span_end){
        var result_dates = [];
        
        cron_schedule.year.forEach(function(v_year){
           cron_schedule.month.forEach(function(v_month){
               // in cron Jan is 1, but in Date Jan is 0.
               if(verify_month(new Date(v_year, v_month-1), span_start, span_end)){
                   if(cron_schedule.dayofweek === "?"){
                       assemble_by_day(result_dates, v_year, v_month, cron_schedule, span_start, span_end);
                   }else{
                       assemble_by_weekday(result_dates, v_year, v_month, cron_schedule, span_start, span_end);
                   }
                   
               }
           }) 
        });
        
        return result_dates;
    }
    
    var assemble_by_day = function(result_dates, v_year, v_month, cron_schedule, span_start, span_end){
       cron_schedule.day.forEach(function(v_day){
           cron_schedule.hour.forEach(function(v_hour){
               cron_schedule.minute.forEach(function(v_minute){
                   // in cron Jan is 1, but in Date Jan is 0.
                   var candidate = new Date(v_year, v_month-1, v_day, v_hour, v_minute);
                   if(verify_date(candidate, span_start, span_end)){
                       result_dates.push(candidate);
                   }
               })
           })
       });
    };
    
    var assemble_by_weekday = function(result_dates, v_year, v_month, cron_schedule, span_start, span_end){
        cron_schedule.dayofweek.forEach(function(v_weekday){
           cron_schedule.hour.forEach(function(v_hour){
               cron_schedule.minute.forEach(function(v_minute){
                   // in cron Jan is 1, but in Date Jan is 0.
                   var days = week_days(v_year, v_month-1, v_weekday);
                   days.forEach(function(v_day){
                      v_day.setHours(v_hour);
                      v_day.setMinutes(v_minute);
                       if(verify_date(v_day, span_start, span_end)){
                           result_dates.push(v_day);
                       }
                   });
               })
           })
       });
    };

    /*********************
    *  Utility method zone
    *********************/
    
    var span_total_minutes = function(start, end){
        var diff = Math.abs(new Date(start) - new Date(end));
        return Math.floor((diff/1000)/60);
    };
    
    var plus_usage = function(id, groups, job){
        var group = groups.filter(function(group){
            return group.id === id;
        })[0];
        
        if(job.State !== "Pending"){
            group.used_minutes = group.used_minutes + span_total_minutes(job.StartTime, job.EndTime);
        }
    };
    
    var render_group_content = function(groups){
        groups.forEach(function(group){
            var progress = Math.floor(group.used_minutes * 100 / group.total_minutes);
            group.content = `<label>${group.robot_name}</label><br><progress max="100" value="${progress}"> ${progress}% </progress>`;
            group.title = `RobotName: ${group.robot_name}, \r\nMachineName: ${group.machine_name}, \r\nEnvironment ${group.environments}, \r\nUsage: ${progress}%`;
            group.order = -group.used_minutes;
        });
    }
    
    var job_class = function(state){
        if("Successful" === state){
            return 'job_item_success';
        }else if("Pending" === state){
            return 'job_item_pending';
        }else{
            return 'job_item_failed';
        }
    };
    
    // date is Date, span_start and span_end is String
    var verify_date = function(date, span_start, span_end){
        return date >= new Date(span_start) && date <= new Date(span_end);
    };
    
    var verify_month = function(date, span_start, span_end){
        var start_date = new Date(span_start);
        var end_data = new Date(span_end);
        
        var start_date_year = start_date.getFullYear();
        var start_date_month = start_date.getMonth();
        
        var end_date_year = end_data.getFullYear();
        var end_date_month = end_data.getMonth();
        
        return date >= new Date(start_date_year, start_date_month) && date <= new Date(end_date_year, end_date_month);
    }
    
    var convert_number = function(dayofweek){
        var map = {
            "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 0
        };
        
        Object.keys(map).forEach(function(value){
            dayofweek = dayofweek.replace(value, map[value]);
        });
        
        return dayofweek;
    };
        
    /**
    * Does not support complex interval like "1-3/4".
    * interval is type of String.
    **/
    var schedule_expand = function(field, interval){
        if(interval.includes(",")){
            // match "N1,N2,N3"
            return interval.split(",").map(function(value){
               return Number(value);
            });
        }else if(interval.includes("-")){
            // match "N1-N3"
            return range(Number(interval.split("-")[0]), Number(interval.split("-")[1]), 1);
        }else if(interval.includes("*") || interval.includes("?") || interval.includes("/")){
            // match "*" or "?" or "/"
            return schedule_expand_wildcast(field, interval);
        }else if(interval === interval.match(/\d+/g)[0]){
            // match "N"
            return [Number(interval)];
        }
    };
    
    var schedule_expand_wildcast = function(field, interval){
        var start = 0;
        var end = 0;
        
        if(field === "minute"){
            start = 0;
            end = 59;
        }else if(field === "hour"){
            start = 1;
            end = 31;
        }else if(field === "month"){
            start = 1;
            end = 12;
        }else if(field === "dayofweek"){
            start = 0;
            end = 6;
        }else if(field == "day"){
            start = 1;
            end = 31;
        }
        
        if(interval.includes("/")){
            start = Number(interval.split("/")[0]);
            if(interval.split("/")[1] === "*" || interval.split("/")[1] === "?"){
                interval = 1;
            }else{
                interval = Number(interval.split("/")[1]);
            }
        }else{
            interval = 1;
        }
        
        return range(start, end, interval);
    };
    
    // all type should be integer. Return array of Date
    // in cron Jan is 1, but in Date Jan is 0.
    var week_days = function(year, month, weekday){
        var d = new Date(year, month, 1);
        var weekdays = [];
        
        // get first weekday of month
        while(d.getDay() !== weekday){
            d.setDate(d.getDate() + 1); // next day
        }
        
        // get all weekdays of month
        while(d.getMonth() === month){
            weekdays.push(new Date(d.getTime()));
            d.setDate(d.getDate() + 7); // next week
        }
        return weekdays;
    };
    
    var range = function(start, stop, step){
        var a = [start];
        var b = start;
        while (b+step <= stop) {
            a.push(b += step || 1);
        }
        return a;
    };
    
    // DATA
    
    
    var schedule_raw_data = function(){
        return [
            {
              "Enabled": true,
              "Name": "ms-test1",
              "ReleaseId": 10,
              "ReleaseKey": "72668a0a-fef8-4f63-8ce6-97572aab66b9",
              "ReleaseName": "ms-seminar-test1_uio-test",
              "PackageName": "ms-seminar-test1",
              "EnvironmentName": "uio-test",
              "EnvironmentId": "2",
              "StartProcessCron": "0 0/1 * 1/1 * ? *",
              "StartProcessCronDetails": "{\"type\":0,\"minutely\":{\"atMinute\":1},\"hourly\":{},\"daily\":{},\"weekly\":{\"weekdays\":[]},\"monthly\":{\"weekdays\":[]},\"advancedCronExpression\":\"\"}",
              "StartProcessCronSummary": "Every minute",
              "StartProcessNextOccurrence": null,
              "StartStrategy": -1,
              "StopProcessExpression": "",
              "StopStrategy": null,
              "ExternalJobKey": "756c49c5-e2ca-4ae8-844d-1aa4f0a207a1",
              "TimeZoneId": "Tokyo Standard Time",
              "TimeZoneIana": "Asia/Tokyo",
              "UseCalendar": false,
              "StopProcessDate": null,
              "InputArguments": null,
              "Id": 2
            },
            {
              "Enabled": true,
              "Name": "test-cron-daily",
              "ReleaseId": 3,
              "ReleaseKey": "c8f3c73d-e815-49db-a490-83235b25344d",
              "ReleaseName": "test-process-user03_sai-test",
              "PackageName": "test-process-user03",
              "EnvironmentName": "sai-test",
              "EnvironmentId": "2",
              "StartProcessCron": "0 0 1 1/1 * ? *",
              "StartProcessCronDetails": "{\"type\":2,\"minutely\":{},\"hourly\":{},\"daily\":{\"atHour\":\"1\",\"atMinute\":0},\"weekly\":{\"weekdays\":[]},\"monthly\":{\"weekdays\":[]},\"advancedCronExpression\":\"\"}",
              "StartProcessCronSummary": "At 01:00 AM",
              "StartProcessNextOccurrence": null,
              "StartStrategy": -1,
              "StopProcessExpression": "",
              "StopStrategy": null,
              "ExternalJobKey": "750e6a9f-e0e2-4a86-b91f-27bc06f4a16a",
              "TimeZoneId": "Tokyo Standard Time",
              "TimeZoneIana": "Asia/Tokyo",
              "UseCalendar": false,
              "StopProcessDate": null,
              "InputArguments": null,
              "Id": 15
            },
            {
              "Enabled": true,
              "Name": "test-cron-weekly",
              "ReleaseId": 3,
              "ReleaseKey": "c8f3c73d-e815-49db-a490-83235b25344d",
              "ReleaseName": "test-process-user03_sai-test",
              "PackageName": "test-process-user03",
              "EnvironmentName": "sai-test",
              "EnvironmentId": "2",
              "StartProcessCron": "0 0 12 ? * MON,TUE *",
              "StartProcessCronDetails": "{\"type\":3,\"minutely\":{},\"hourly\":{},\"daily\":{},\"weekly\":{\"weekdays\":[{\"id\":\"MON\",\"weekly\":\"Monday\",\"monthly\":\"Monday\"},{\"id\":\"TUE\",\"weekly\":\"Tuesday\",\"monthly\":\"Tuesday\"}],\"atHour\":0,\"atMinute\":0},\"monthly\":{\"weekdays\":[]},\"advancedCronExpression\":\"\"}",
              "StartProcessCronSummary": "At 12:00 AM, only on Monday and Tuesday",
              "StartProcessNextOccurrence": null,
              "StartStrategy": 1,
              "StopProcessExpression": "",
              "StopStrategy": null,
              "ExternalJobKey": "07bc5358-d325-47dc-b240-cef2be55722d",
              "TimeZoneId": "Tokyo Standard Time",
              "TimeZoneIana": "Asia/Tokyo",
              "UseCalendar": false,
              "StopProcessDate": null,
              "InputArguments": null,
              "Id": 16
            },
            {
              "Enabled": true,
              "Name": "test-cron-monthly",
              "ReleaseId": 3,
              "ReleaseKey": "c8f3c73d-e815-49db-a490-83235b25344d",
              "ReleaseName": "test-process-user03_sai-test",
              "PackageName": "test-process-user03",
              "EnvironmentName": "sai-test",
              "EnvironmentId": "2",
              "StartProcessCron": "0 0 0 ? 1/2 MON,TUE,WED,THU,FRI,SAT,SUN *",
              "StartProcessCronDetails": "{\"type\":4,\"minutely\":{},\"hourly\":{},\"daily\":{},\"weekly\":{\"weekdays\":[]},\"monthly\":{\"weekdays\":[{\"id\":\"MON\",\"weekly\":\"Monday\",\"monthly\":\"Monday\"},{\"id\":\"TUE\",\"weekly\":\"Tuesday\",\"monthly\":\"Tuesday\"},{\"id\":\"WED\",\"weekly\":\"Wednesday\",\"monthly\":\"Wednesday\"},{\"id\":\"THU\",\"weekly\":\"Thursday\",\"monthly\":\"Thursday\"},{\"id\":\"FRI\",\"weekly\":\"Friday\",\"monthly\":\"Friday\"},{\"id\":\"SAT\",\"weekly\":\"Saturday\",\"monthly\":\"Saturday\"},{\"id\":\"SUN\",\"weekly\":\"Sunday\",\"monthly\":\"Sunday\"}],\"atMinute\":0,\"atHour\":0,\"frequencyInMonths\":\"2\"},\"advancedCronExpression\":\"\"}",
              "StartProcessCronSummary": "At 12:00 AM, only on Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, and Sunday, every 2 months",
              "StartProcessNextOccurrence": null,
              "StartStrategy": 0,
              "StopProcessExpression": "",
              "StopStrategy": null,
              "ExternalJobKey": "84d6c61a-c382-4479-b086-02aed4c8cf73",
              "TimeZoneId": "Tokyo Standard Time",
              "TimeZoneIana": "Asia/Tokyo",
              "UseCalendar": false,
              "StopProcessDate": null,
              "InputArguments": null,
              "Id": 17
            },
            {
              "Enabled": false,
              "Name": "test-cron-advanced",
              "ReleaseId": 3,
              "ReleaseKey": "c8f3c73d-e815-49db-a490-83235b25344d",
              "ReleaseName": "test-process-user03_sai-test",
              "PackageName": "test-process-user03",
              "EnvironmentName": "sai-test",
              "EnvironmentId": "2",
              "StartProcessCron": "* * * * * ? *",
              "StartProcessCronDetails": "{\"type\":5,\"minutely\":{},\"hourly\":{},\"daily\":{},\"weekly\":{\"weekdays\":[]},\"monthly\":{\"weekdays\":[]},\"advancedCronExpression\":\"* * * * * ? *\"}",
              "StartProcessCronSummary": "Every second",
              "StartProcessNextOccurrence": null,
              "StartStrategy": -1,
              "StopProcessExpression": "",
              "StopStrategy": null,
              "ExternalJobKey": "56afc5f7-3452-4b8d-881e-e374c8e4cfbb",
              "TimeZoneId": "Tokyo Standard Time",
              "TimeZoneIana": "Asia/Tokyo",
              "UseCalendar": false,
              "StopProcessDate": null,
              "InputArguments": null,
              "Id": 18
            }
          ]
    };
    
    var jobs_raw_data = function(){
        return [
            {
              "Key": "66b0d62e-cb16-4bb6-9887-7fc4167d99b5",
              "StartTime": "2019-06-10T07:35:17.523Z",
              "EndTime": "2019-06-10T09:35:20.213Z",
              "State": "Successful",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "6aaebdb8-20ea-4ec9-954e-aec16bc41461",
              "Info": "ジョブは完了しました",
              "CreationTime": "2019-02-12T15:34:00.29Z",
              "StartingScheduleId": 1,
              "ReleaseName": "test-process-user03_sai-test",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-AIO7BTU",
              "Id": 86
            },
            {
              "Key": "cc99c8fe-fa53-43ce-9cb8-320d9769efcb",
              "StartTime": "2019-06-09T17:20:00.43Z",
              "EndTime": "2019-06-09T21:20:08.32Z",
              "State": "Successful",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "e53b0d0a-0dbf-4b36-a946-105c1ce6fcbf",
              "Info": "Job completed",
              "CreationTime": "2019-04-24T03:20:00.35Z",
              "StartingScheduleId": 10,
              "ReleaseName": "test-process-user03_sai-test",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-47UQ88B",
              "Id": 4247
            },
            {
              "Key": "cc99c8fe-fa53-43ce-9cb8-320d9769efcb",
              "StartTime": null,
              "EndTime": null,
              "State": "Pending",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "e53b0d0a-0dbf-4b36-a946-105c1ce6fcbf",
              "Info": "Job completed",
              "CreationTime": "2019-06-10T04:20:00.43Z",
              "StartingScheduleId": 10,
              "ReleaseName": "test-process-user03_sai-test",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-HTBUA20",
              "Id": 4247
            },
            {
              "Key": "cc99c8fe-fa53-43ce-9cb8-320d9769efcb",
              "StartTime": "2019-06-10T04:20:00.43Z",
              "EndTime": "2019-06-10T07:20:08.32Z",
              "State": "Faulted",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "e53b0d0a-0dbf-4b36-a946-105c1ce6fcbf",
              "Info": "Job completed",
              "CreationTime": "2019-04-24T03:20:00.35Z",
              "StartingScheduleId": 10,
              "ReleaseName": "test-process-user03_sai-test",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-47UQ88B",
              "Id": 4248
            }
        ];
    };
    
    var robot_raw_data = function(){
        return [
            {
              "LicenseKey": null,
              "MachineName": "EC2AMAZ-AIO7BTU",
              "MachineId": 107,
              "Name": "robot-A",
              "Username": "administrator",
              "Description": "alive",
              "Version": "18.2.6.0",
              "Type": "Unattended",
              "HostingType": "Standard",
              "Password": null,
              "CredentialType": null,
              "RobotEnvironments": "sai-test",
              "Id": 120,
              "ExecutionSettings": null
            },
            {
              "LicenseKey": null,
              "MachineName": "EC2AMAZ-47UQ88B",
              "MachineId": 108,
              "Name": "robot-B",
              "Username": "administrator",
              "Description": "alive",
              "Version": "18.2.6.0",
              "Type": "Unattended",
              "HostingType": "Standard",
              "Password": null,
              "CredentialType": null,
              "RobotEnvironments": "sai-test",
              "Id": 121,
              "ExecutionSettings": null
            },
            {
              "LicenseKey": null,
              "MachineName": "EC2AMAZ-HTBUA20",
              "MachineId": 109,
              "Name": "robot-C",
              "Username": "administrator",
              "Description": "alive",
              "Version": "18.2.6.0",
              "Type": "Unattended",
              "HostingType": "Standard",
              "Password": null,
              "CredentialType": null,
              "RobotEnvironments": "sai-test",
              "Id": 122,
              "ExecutionSettings": null
            },
            {
              "LicenseKey": null,
              "MachineName": "EC2AMAZ-USJB5Q8",
              "MachineId": 104,
              "Name": "robot-D",
              "Username": "administrator",
              "Description": null,
              "Version": "18.2.6.0",
              "Type": "Unattended",
              "HostingType": "Standard",
              "Password": null,
              "CredentialType": null,
              "RobotEnvironments": "uio-test",
              "Id": 117,
              "ExecutionSettings": null
            }
        ];
    };
    
    
    main();
});




