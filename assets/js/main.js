$(document).ready(function(){
    var main = function(){
        //group_example();
        real_example("2019-06-10 00:00:00", "2019-06-10 23:59:59");
    }
    
    var group_example = function(){
      // create groups to highlight groupUpdate
      var groups = new vis.DataSet([
        {id: 1, content: 'Machine 1', className: 'vis-group-red', envId: 1},
        {id: 2, content: 'Machine 2', className: 'vis-group-yellow', envId: 2},
        {id: 3, content: 'Machine 3', className: 'vis-group-blue', envId: 3}  
      ]);


      // create a DataSet with items
      var items = new vis.DataSet([
        {id: 1, content: 'Job1', type: 'range', start: '2010-08-23T00:00:00', end: '2010-08-23T23:59:00', group: 3},
        {id: 2, content: 'Job2', type: 'range', start: '2010-08-24T00:00:00', end: '2010-08-24T23:59:00', group: 2},
        {id: 3, content: 'Job3', type: 'range', start: '2010-08-25T00:00:00', end: '2010-08-25T23:59:00', group: 1},
        {id: 4, content: 'Job4', start: '2010-08-26', end: '2010-09-02', group: 3},
        {id: 5, content: 'Job5', start: '2010-08-28', end: '2010-08-29', group: 1},
        {id: 7, content: 'Job7', start: '2010-08-30', end: '2010-09-03', group: 1},
        {id: 8, content: 'Job8', title: 'Job8, Status:Success, Start: 2010-09-04T12:00:00, Duration: 1hour', start: '2010-09-04T12:00:00', end: '2010-09-04T24:00:00', group: 2},
        {id: 10, content: 's', title: 'Sch1, start:2010-08-23T00:00:00', type: 'point', start: '2010-08-23T00:00:00', group: 1},
        {id: 11, content: 's', title: 'Sch2, start:2010-08-27T00:00:00', type: 'point', start: '2010-08-27T00:00:00', group: 1}
      ]);

      var container = document.getElementById('visualization');

      var options = {
        editable: false,   // default for all items
        horizontalScroll: false
      };

      var timeline = new vis.Timeline(container, items, groups, options);
    };
    
    var real_example = function(span_start, span_end){
        var in_out = {
            index: 0,
            groups: [],
            items: []
        };
        
        schedule_entry(in_out, span_start, span_end);

        job_entry(in_out, span_start, span_end);

        
        var vis_groups = new vis.DataSet(in_out.groups);
        var vis_items = new vis.DataSet(in_out.items);
        var container = document.getElementById('visualization');

        var options = {
            editable: false,   // default for all items
            horizontalScroll: false,
            tooltip: {overflowMethod: 'cap'}
        };
        new vis.Timeline(container, vis_items, vis_groups, options);
    }
    
    var job_entry = function(params, span_start, span_end){
        var job_data = jobs_raw_data().filter(function(value){
            var condition_type = value.SourceType === "Schedule";
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
            params.index++;
            
            var jobs_arr = machine_groups[key];
            params.groups.push({
                id: params.index,
                content: key
            });
            
            jobs_arr.forEach(function(job){
                params.items.push({
                    content: job.ReleaseName,
                    title: "Name: " + job.ReleaseName + ",<br>Status: " + job.State,
                    type: 'range',
                    start: job.StartTime,
                    end: job.EndTime,
                    group: params.index
                });
            });
        }
        

    };
   
    var schedule_entry = function(params, span_start, span_end){
        var schedule_data = $.grep(schedule_raw_data(), function(value){
            return value.Enabled === true;
        });

        var env_schedules = {}; // {1: {envId: 1, envName: a, schedules: [{cron:}]}}
        schedule_data.forEach(function(value){
            if(value.EnvironmentId in env_schedules){
                // add schedule to the found environment
                var env_schedule = env_schedules[value.EnvironmentId];
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
                params.index++;
                env_schedules[value.EnvironmentId] = {
                    id: params.index,
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
                
        for(var key in env_schedules){
            var schedule_obj = env_schedules[key];
            params.groups.push({
               id:  schedule_obj.id,
               content: schedule_obj.content
            });
            
            schedule_obj.schedules.forEach(function(cron){
                if(cron.is_schedule_minutely){
                    params.items.push({
                       content: cron.schedule_name + ", " + cron.schedule_summary, 
                       title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Start: " + cron.schedule_summary,
                       type: 'range', 
                       start: span_start,
                       end: span_end,
                       group: schedule_obj.id
                    });
                }else{
                    var start_times = schedule_start_time(cron.schedule_cron, span_start, span_end);
                    start_times.forEach(function(starts){
                        params.items.push({
                           content: 's', // content is meaningless here
                           title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Start: " + starts,
                           type: 'point', 
                           start: starts, 
                           group: schedule_obj.id
                        });
                    });    
                }
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
    * Test method
    **/
    var test_schedule_expand = function(){
        console.log(schedule_expand("minute", "1"));
        console.log(schedule_expand("minute", "1-3"));
        console.log(schedule_expand("minute", "1,2,3,6"));
        console.log(schedule_expand("minute", "*"));
        console.log(schedule_expand("minute", "2/*"));
        console.log(schedule_expand("minute", "2/1"));
        console.log(schedule_expand("minute", "20/2"));
        console.log(schedule_expand("minute", "?"));
        console.log(schedule_expand("dayofweek", "?"));
        console.log(schedule_expand("day", "?"));
        
    };
    
    var test_weekdays = function(){
        console.log(week_days(2019,0,1)); // Jan
        console.log(week_days(2019,6,2)); // July
        console.log(week_days(2019,6,3));
        console.log(week_days(2019,6,4));
        console.log(week_days(2019,6,5));
        console.log(week_days(2019,6,6));
        console.log(week_days(2019,6,0));
    };
    
    var test_schedule_start_time = function(){
        console.log("0 0 1 1/1 * ? *" + "  , "+"2019-06-10 00:00:00"+"  , "+"2019-06-10 23:59:59");
        console.log(schedule_start_time("0 0 1 1/1 * ? *", "2019-06-10 00:00:00", "2019-06-10 23:59:59"));
        console.log("0 0 0 ? * MON,TUE *" + "  , "+"2019-10-10 00:00:00"+"  , "+"2019-10-17 23:59:59");
        console.log(schedule_start_time("0 0 0 ? * MON,TUE *", "2019-10-10 00:00:00", "2019-10-17 23:59:59"));
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
    
    var schedule_raw_data = function(){
        return [
            {
              "Enabled": true,
              "Name": "ms-test1",
              "ReleaseId": 10,
              "ReleaseKey": "72668a0a-fef8-4f63-8ce6-97572aab66b9",
              "ReleaseName": "ms-seminar-test1_kajimoto-laptop",
              "PackageName": "ms-seminar-test1",
              "EnvironmentName": "kajimoto-laptop",
              "EnvironmentId": "4",
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
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "PackageName": "test-process-user03",
              "EnvironmentName": "horizon-hamburg",
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
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "PackageName": "test-process-user03",
              "EnvironmentName": "horizon-hamburg",
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
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "PackageName": "test-process-user03",
              "EnvironmentName": "horizon-hamburg",
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
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "PackageName": "test-process-user03",
              "EnvironmentName": "horizon-hamburg",
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
              "EndTime": "2019-06-10T08:35:20.213Z",
              "State": "Successful",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "6aaebdb8-20ea-4ec9-954e-aec16bc41461",
              "Info": "ジョブは完了しました",
              "CreationTime": "2019-02-12T15:34:00.29Z",
              "StartingScheduleId": 1,
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "LAPTOP-54PF641Q",
              "Id": 86
            },
            {
              "Key": "cc99c8fe-fa53-43ce-9cb8-320d9769efcb",
              "StartTime": "2019-06-10T03:20:00.43Z",
              "EndTime": "2019-06-10T04:20:08.32Z",
              "State": "Successful",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "e53b0d0a-0dbf-4b36-a946-105c1ce6fcbf",
              "Info": "Job completed",
              "CreationTime": "2019-04-24T03:20:00.35Z",
              "StartingScheduleId": 10,
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-PP9F3RB",
              "Id": 4247
            },
            {
              "Key": "cc99c8fe-fa53-43ce-9cb8-320d9769efcb",
              "StartTime": "2019-06-10T06:20:00.43Z",
              "EndTime": "2019-06-10T07:20:08.32Z",
              "State": "Successful",
              "Source": "test-cron-weekly",
              "SourceType": "Schedule",
              "BatchExecutionKey": "e53b0d0a-0dbf-4b36-a946-105c1ce6fcbf",
              "Info": "Job completed",
              "CreationTime": "2019-04-24T03:20:00.35Z",
              "StartingScheduleId": 10,
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "Type": "Unattended",
              "InputArguments": null,
              "OutputArguments": "{}",
              "HostMachineName": "EC2AMAZ-PP9F3RB",
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
              "Name": "rt-EC2AMAZ-AIO7BTU",
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
              "Name": "rt-EC2AMAZ-47UQ88B",
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
              "Name": "rt-EC2AMAZ-HTBUA20",
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
            }            
        ];
    };
    
    
    main();
});




