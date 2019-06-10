$(document).ready(function(){
    var main = function(){
        group_example();
        //analyze_schedule_raw();
        //test_schedule_expand();
        //test_weekdays();
        test_schedule_start_time();
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
        {id: 8, content: 'Job8', start: '2010-09-04T12:00:00', end: '2010-09-04T24:00:00', group: 2},
        {id: 10, content: 'Sch1', type: 'point', start: '2010-08-23T00:00:00', group: 1},
        {id: 11, content: 'Sch2', type: 'point', start: '2010-08-27T00:00:00', group: 1}
      ]);

      var container = document.getElementById('visualization');

      var options = {
        editable: false,   // default for all items
        horizontalScroll: false
      };

      var timeline = new vis.Timeline(container, items, groups, options);
    };

    // 
    
    var analyze_schedule_raw = function(){
        var schedule_data = $.grep(schedule_raw_data(), function(value, index){
            return value.Enabled === true;
        });
        
    };
    
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
        
        console.log(cron_schedule);
        
        //return [];
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
                   
               }{
                   //console.log(new Date(v_year,v_month));
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
            "MON": 1,
            "TUE": 2,
            "WED": 3,
            "THU": 4,
            "FRI": 5,
            "SAT": 6,
            "SUN": 0
        };
        
        Object.keys(map).forEach(function(value, index){
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
    }
    
    var range = function(start, stop, step){
        var a = [start];
        var b = start;
        while (b+step <= stop) {
            a.push(b += step || 1);
        }
        return a;
    }
    
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
              "Enabled": false,
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
              "Enabled": false,
              "Name": "test-cron-weekly",
              "ReleaseId": 3,
              "ReleaseKey": "c8f3c73d-e815-49db-a490-83235b25344d",
              "ReleaseName": "test-process-user03_horizon-hamburg",
              "PackageName": "test-process-user03",
              "EnvironmentName": "horizon-hamburg",
              "EnvironmentId": "2",
              "StartProcessCron": "0 0 0 ? * MON,TUE *",
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
              "Enabled": false,
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
    }
    
    
    main();
});




