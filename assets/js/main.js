$(document).ready(function(){
    var main = function(){
        $("#time-span").append(global_span_start + " ~ " + global_span_end);
        viewer(global_span_start, global_span_end);
    }
    
    var viewer = function(span_start, span_end){
        var in_out = {
            index: 0,
            groups: [],
            items: [],
            visible_groups: [],
            page_size: 10,
            page_num: 1,
            unresponsive_robots: []
        };
        
        console.time('robot_entry');
        robot_entry(in_out, span_start, span_end);
        console.timeEnd('robot_entry');
        
        console.time('schedule_entry');
        schedule_entry(in_out, span_start, span_end);
        console.timeEnd('schedule_entry');

        console.time('job_entry');
        job_entry(in_out, span_start, span_end);
        console.timeEnd('job_entry');
        
        render_group_content(in_out.groups);
          
        in_out.groups = sort_robots(in_out.groups);
        
        in_out.visible_groups = in_out.groups;

        
        var paged_groups = robot_paging(in_out);
        var vis_groups = new vis.DataSet(paged_groups);
        var vis_items = new vis.DataSet(in_out.items);
        var container = document.getElementById('visualization');

        var options = {
            editable: false,   // default for all items
            selectable: true,
            stack: false,
            horizontalScroll: false,
            verticalScroll: true,
            orientation: 'both',
            clickToUse: true,
            autoResize: true,
            zoomKey: 'altKey',
            zoomMin: 1000 * 60 * 60 * 24,             // one day 
            zoomMax: 1000 * 60 * 60 * 24 * 31 * 2,    // two months
            tooltip: {overflowMethod: 'cap'}
        };
        
        console.time('render');
        var timeline = new vis.Timeline(container, vis_items, vis_groups, options);
        timeline_handler(timeline);
        robot_handler(timeline, in_out);
        romovable_robot_handler(in_out);
        console.timeEnd('render');
    };
    
    var robot_entry = function(params, span_start, span_end){
        var total_minutes = span_total_minutes(span_start, span_end);
        
        // TBD: add filter here.
        robot_raw_data().filter(function(value){
            return robot_filter(value);
        }).forEach(function(robot){
            params.index++;
            var robot_status = robot_states(robot);
            params.groups.push({
                id: params.index,
                machine_name: robot.MachineName,
                environments: robot.RobotEnvironments.split(","),
                robot_name: robot.Name,
                type: robot.Type,
                status: robot_status,
                visible: true,
                className: group_class(robot, robot_status),
                total_minutes: total_minutes,
                used_minutes: 0
            });
        });
    };
    
    var job_entry = function(params, span_start, span_end){
        var job_data = jobs_raw_data().filter(function(value){
            // TBD: add more filters here, like "schedule, manual, agent"
            var condition_type = value.SourceType !== "";
            if("Pending" === value.State){
                value.StartTime = value.CreationTime;
                value.EndTime = span_end;
            }
            if(value.EndTime == undefined && "Running" == value.State){
                value.EndTime = value.StartTime
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
                continue;
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
                    title: "Name: " + job.ReleaseName + ",<br>Source: " + job.Source + ",<br>Span: " + span_total_time(job.StartTime, job.EndTime) + ", " + get_time(job.StartTime) + " ~ " + get_time(job.EndTime) + ",<br>Status: " + job.State,
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
                    is_schedule_minutely: scheduler_type_minutely(value),
                    schedule_summary: value.StartProcessCronSummary,
                    environment_name: value.EnvironmentName,
                    package: value.PackageName,
                    release_name: value.ReleaseName,
                    executor_robot: value.ExecutorRobots
                });
            }else{
                env_schedules[value.EnvironmentName] = {
                    content: value.EnvironmentName,
                    envId: value.EnvironmentId,
                    schedules:[{
                        schedule_cron: value.StartProcessCron,
                        schedule_name: value.Name,
                        is_schedule_minutely: scheduler_type_minutely(value),
                        schedule_summary: value.StartProcessCronSummary,
                        environment_name: value.EnvironmentName,
                        package: value.PackageName,
                        release_name: value.ReleaseName,
                        executor_robot: value.ExecutorRobots
                    }]
                };
            }
        });
                
        for(var env_name in env_schedules){
            var schedule_obj = env_schedules[env_name];

            // Find group id for environment
            var groups = params.groups.filter(function(group){
                return group.environments.includes(env_name);
            });
            
            groups.forEach(function(group){
                schedule_obj.schedules.filter(function(schedule){
                    if(schedule.executor_robot.length > 0){
                        return schedule.executor_robot.filter(function(robot){
                            return robot.Name === group.robot_name;
                        }).length > 0;
                    }else{
                        return true; // scheduler will be added to all environment robots.
                    }
                }).forEach(function(cron){
                    if(cron.is_schedule_minutely){
                        params.items.push({
                           content: "", 
                           title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Start: " + cron.schedule_summary,
                           type: 'range', 
                           start: span_start,
                           end: span_end,
                           className: 'schedule_item',
                           group: group.id
                        });
                    }else{
                        var start_times = schedule_start_time(cron.schedule_cron, span_start, span_end);
                        start_times.forEach(function(starts){
                            params.items.push({
                               content: "", // content is meaningless here
                               title: "Name: " + cron.schedule_name + ",<br>Environment: " + cron.environment_name + ",<br>Package: " + cron.package + ",<br>Summary: " + cron.schedule_summary + ",<br>Start: " + starts.toLocaleDateString() + " " + starts.toLocaleTimeString(),
                               type: 'point', 
                               start: starts,
                               className: 'schedule_item',
                               group: group.id
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
    var timeline_handler = function(timeline){
        timeline.on('doubleClick', function(props){
            var selectedItem = props.event.target.innerText;
            if(selectedItem != undefined){
                $("#selected-item").html("<span>"+selectedItem+"</span>");
            }
        });
    };
    
    var robot_handler = function(timeline, in_out){
        count_visible(in_out.visible_groups);
        $("#type_ok").click(function(){
            $(".current_page").text('1');
            in_out.page_num = 1;
            in_out.visible_groups = get_visible_robots(in_out.groups);
            var paged_groups = robot_paging(in_out);
            
            timeline.setGroups(paged_groups);
            timeline.redraw();
            count_visible(in_out.visible_groups);
        });
        $(".page_size").on("change", function(){
            $(".page_size").val(this.value.toString()); // sync page_size
            $(".current_page").text('1'); // initial page num
            in_out.page_size = this.value.toString();
            in_out.page_num = 1;
            var paged_groups = robot_paging(in_out);
            timeline.setGroups(paged_groups);
            timeline.redraw();
        });
        $(".page_left").on("click", function(){
            if(in_out.page_num <= 1){
                return;
            }
            in_out.page_num = in_out.page_num -1;
            $(".current_page").text(in_out.page_num.toString());
            timeline.setGroups(robot_paging(in_out));
            timeline.redraw();
        });
        $(".page_right").on("click", function(){
            if(in_out.visible_groups.length % in_out.page_size == 0){
                if(in_out.page_num == in_out.visible_groups.length/in_out.page_size){
                    return;
                }
            }else{
                if(in_out.page_num > in_out.visible_groups.length/in_out.page_size){
                    return;
                }
            }
            in_out.page_num = in_out.page_num + 1;
            $(".current_page").text(in_out.page_num.toString());
            timeline.setGroups(robot_paging(in_out));
            timeline.redraw();
        });
    };
    
    var romovable_robot_handler = function(in_out){
        var params = {
            "ur": 20,
            "ar": 20,
            "others": 20,
            "ws": false,
            "ws_json": {},
            "show_table":true,
            "show_csv":false
        };
        
        var reader = new FileReader();
        
        $("#open_modal").on("click", function(){
            $("#removable_robot_modal").modal({
                clickClose: false,
                showClose: true});
        });
        
        $("#ur_unresponsive").on("input", function(){
            $("#ur_limit").html("<span>"+this.value+"</span>");
            params.ur = this.value;
        });
        
        $("#ar_unresponsive").on("input", function(){
            $("#ar_limit").html("<span>"+this.value+"</span>");
            params.ar = this.value;
        });
        
        $("#others_unresponsive").on("input", function(){
            $("#others_limit").html("<span>"+this.value+"</span>");
            params.others = this.value;
        });

        $("#ur_unresponsive").on("change", function(){
            if(params.ws){
                show_ws_table(in_out, params);
            }else{
                show_robot_table(in_out, params);
            }
        });
        
        $("#ar_unresponsive").on("change", function(){
            if(params.ws){
                show_ws_table(in_out, params);
            }else{
                show_robot_table(in_out, params);
            }
        });
        
        $("#others_unresponsive").on("change", function(){
            if(params.ws){
                show_ws_table(in_out, params);
            }else{
                show_robot_table(in_out, params);
            }
        });

        
        $("#removable_robot_modal").on($.modal.OPEN, function(event, modal){
            show_robot_table(in_out, params);
        });
        
        $("#ws_file").on("change", function(event){
            if(window.FileReader){
                reader.readAsText(event.target.files[0]);
                reader.onload = function(event){
                    var csv_data = Papa.parse(event.target.result,{skipEmptyLines: true});
                    params.ws_json = get_ws_json(csv_data);
                    params.ws = true;
                    show_ws_table(in_out, params);
                };
                reader.onerror = wsError;
            }else{
                alert("FileReader is not supported in this broswer!")
            }
        });
        
        $("#table_csv_switch").on("change", function(event){
            if($(this).is(':checked')){
                params.show_table = true;
                params.show_csv = false;
                $("#table_unresponsive_robot").show();
                $("#csv_unresponsive_robot").hide();
            }else{
                params.show_table = false;
                params.show_csv = true;
                $("#table_unresponsive_robot").hide();
                $("#csv_unresponsive_robot").show();
            }
            if(params.ws){
                show_ws_table(in_out, params);
            }else{
                show_robot_table(in_out, params);
            }
        });
        
        
        var show_robot_table = function(in_out, params){
            in_out.unresponsive_robots = filter_unresponsive_robot(params.ur, params.ar, params.others,in_out.visible_groups);
            if(params.show_table){
                $("#table_unresponsive_robot").footable({
                    "columns": [
                        { "name": "robot_name", "title": "Robot Name", "breakpoints": "xs" },
                        { "name": "machine_name", "title": "Machine Name" },
                        { "name": "environment", "title": "Environment" },
                        { "name": "type", "title": "Type" },
                        { "name": "last_update", "title": "Last Update", "breakpoints": "xs" },
                        { "name": "comment", "title": "Comment", "breakpoints": "xs sm" }
                    ],
                    "rows": in_out.unresponsive_robots
                });    
            }
            if(params.show_csv){
                var csvdata = in_out.unresponsive_robots.map(el => ({
                                                                     "Robot Name":el.robot_name,
                                                                     "Machine Name":el.machine_name,
                                                                     "Environment":el.environment,
                                                                     "Type":el.type,
                                                                     "Last Update":el.last_update,
                                                                     "Comment":el.comment
                                                                    }));
                var csv = Papa.unparse(csvdata);
                $("#csv_unresponsive_robot").text(csv);    
            }
            $("#unresponsive_count").html("<span>" + in_out.unresponsive_robots.length + "</span>");
        }
        
        var show_ws_table = function(in_out, params){
            in_out.unresponsive_robots = join_robot_ws(in_out.visible_groups, copy_json(params.ws_json), params.ar, params.ur);
            in_out.unresponsive_robots = filter_unresponsive_robot(params.ur, params.ar, params.others,in_out.unresponsive_robots);
            if(params.show_table){
                $("#table_unresponsive_robot").footable({
                    "columns": [
                        { "name": "workspace_id", "title": "Workspace ID", "breakpoints": "xs"},
                        { "name": "username", "title": "Workspace Username", "breakpoints": "sm"},
                        { "name": "robot_name", "title": "Robot Name", "breakpoints": "sm"},
                        { "name": "machine_name", "title": "Machine Name", "breakpoints": "sm"},
                        { "name": "environment", "title": "Environment", "breakpoints": "sm"},
                        { "name": "type", "title": "Type", "breakpoints": "sm"}, 
                        { "name": "last_update", "title": "Last Update", "breakpoints": "xs"},
                        { "name": "comment", "title": "Comment", "breakpoints": "xs"}
                    ],
                    "rows": in_out.unresponsive_robots
                }); 
            }
            if(params.show_csv){
                var csvdata = in_out.unresponsive_robots.map(el => ({
                                                                     "Workspace ID":el.workspace_id,
                                                                     "Workspace Username":el.username,
                                                                     "Robot Name":el.robot_name,
                                                                     "Machine Name":el.machine_name,
                                                                     "Environment":el.environment,
                                                                     "Type":el.type,
                                                                     "Last Update":el.last_update,
                                                                     "Comment":el.comment
                                                                    }));
                var csv = Papa.unparse(csvdata);
                $("#csv_unresponsive_robot").text(csv);    
            }
            $("#unresponsive_count").html("<span>" + in_out.unresponsive_robots.length + "</span>");
        }
    };
    
    var copy_json = function(src) {
        return JSON.parse(JSON.stringify(src));
    };
    
    // Rule:
    // For UR, if it is unresponsive over limit time, or it has no job in the time span.
    // For AR and Others, if it is unresponsive over limit time.
    var filter_unresponsive_robot = function(ur_limit, ar_limit, others_limit, robot_list){
        var res_arr = [];
        robot_list.forEach(function(item){
            // filter robot
            if(item.type == "Unattended"){
                var comment = [];
                
                //if(item.used_minutes == 0){
                //    comment.push("No jobs");
                //}
                
                if(is_unresponsive_over_limit(ur_limit, item)){
                    comment.push("Unresponsive");
                }
                
                if(comment.length > 0){
                    res_arr.push({
                        workspace_id: item.workspace_id,
                        username: item.username,
                        robot_name: item.robot_name,
                        machine_name: item.machine_name,
                        last_update: item.status.last_update,
                        environment: item.environments.join(","),
                        type: item.type,
                        comment: comment.join(" & ")
                    });
                }
            }else if(item.type == "Attended"){
                if(is_unresponsive_over_limit(ar_limit, item)){
                    res_arr.push({
                        workspace_id: item.workspace_id,
                        username: item.username,
                        robot_name: item.robot_name,
                        machine_name: item.machine_name,
                        last_update: item.status.last_update,
                        environment: item.environments.join(","),
                        type: item.type,
                        comment: "Unresponsive"
                    });
                }
            }else if(item.type == "ALWAYS_ON" || item.type == "AUTO_STOP"){
                res_arr.push(item);
            }else{
                if(is_unresponsive_over_limit(others_limit, item)){
                    res_arr.push({
                        workspace_id: item.workspace_id,
                        username: item.username,
                        robot_name: item.robot_name,
                        machine_name: item.machine_name,
                        last_update: item.status.last_update,
                        environment: item.environments.join(","),
                        type: item.type,
                        comment: "Unresponsive"
                    });
                }
            }
        });
        return res_arr;
    };
    
    var is_unresponsive_over_limit = function(limit, robot){
        if(robot.status.responsive){
            return false;
        }else{
            var diff = moment().diff(moment(robot.status.last_update), 'days');
            if(diff >= limit){
                return true;
            }else{
                return false;
            }
        }
    };
    
    var is_ws_over_limit = function(par){
        if(par.ws.last_active_time == undefined || par.ws.last_active_time == ""){
            par.comment = "No last update";
            return true;
        }
        var diff = moment().diff(moment(par.ws.last_active_time), 'days');
        if(diff >= par.limit){
            par.comment = "Not Active"
            return true;
        }else{
            return false;
        }
    }
    
    // Return both unresponsive robots and workspaces, even if they have no matching machine name.
    var join_robot_ws = function(robot_array, ws_json, ar_limit, ur_limit){
        var result = [];
        robot_array.forEach(function(robot){
            if(ws_json.hasOwnProperty(robot.machine_name)){
                // if machine name match.
                robot.workspace_id = ws_json[robot.machine_name].workspace_id;
                robot.username = ws_json[robot.machine_name].username;
                delete ws_json[robot.machine_name]; // delete ws if it is matched. Easier for further processing.
            }else{
                robot.workspace_id = "";
                robot.username = "";
            }
            result.push(robot);
        });
        for(var machine_name in ws_json){
            result.push({
                "workspace_id": ws_json[machine_name].workspace_id,
                "username": ws_json[machine_name].username,
                "robot_name": "",
                "environment": "",
                "machine_name": ws_json[machine_name].computer_name,
                "last_update": ws_json[machine_name].last_active_time,
                "type": ws_json[machine_name].running_mode,
                "comment": "No robot"
            });
        }
        return result;
    }
        
    var get_ws_json = function(csv_data){
        var ws_json = {};
        csv_data.data.forEach(function(item){
            ws_json[item[2]]= {
                "workspace_id": item[0],
                "directory_id": item[1],
                "computer_name": item[2],
                "username": item[3],
                "bundle_id": item[4],
                "ip": item[5],
                "running_mode": item[6],
                "vm_type": item[7],
                "last_active_time": item[8]
            };
        });
        return ws_json;
    };
    
    var wsError = function(event){
        alert("Failed to load file!");
    };
    
    var get_visible_robots = function(robots){
        var types = {
            ur : $("#ur").is(":checked"),
            ar : $("#ar").is(":checked"),
            others : $("#others").is(":checked")
        }
        return robot_type_filter(robots, types);
    };
    
    var robot_type_filter = function(robots, types){
        robots.forEach(function(robot){
            if(robot.type == "Unattended"){
                if(types.ur){
                    robot.visible = true;
                }else{
                    robot.visible = false;
                }
            }else if(robot.type == "Attended"){
                if(types.ar){
                    robot.visible = true;
                }else{
                    robot.visible = false;
                }
            }else{
                if(types.others){
                    robot.visible = true;
                }else{
                    robot.visible = false;
                }
            }
        });
        return robots.filter(function(robot){return robot.visible == true;});
    };
    
    
    var robot_paging = function(in_out){
        var page_start_index = (in_out.page_num - 1) * in_out.page_size;
        var page_end_index = in_out.page_num * in_out.page_size;
        return in_out.visible_groups.slice(page_start_index, page_end_index);
    }
    
    var sort_robots = function(robots){
        return robots.sort(function(foo, bar){
           return bar.used_minutes - foo.used_minutes;
        });
    }
        
    var count_visible = function(visible_robot){
        $("#robot_count").html("<span>" + visible_robot.length + "</span>");
    };
    
    var get_page_info = function(){
        var page_size = $(".page_size").first().children("option:selected").val();
        var cur_page = $(".current_page").first().text();
        return {
            page_size: parseInt(page_size),
            page_num: parseInt(cur_page)
        };
    };
    
    var set_page_info = function(page_size, page_num){
        $(".page_size").val(page_size.toString());
        $(".current_page").text(page_num.toString());
    };
    
    var robot_filter = function(robot){
        var filter = filter_raw_data();
        var exclude_hit = filter.robot.excludes.filter(function(exc){
            return exc.toLowerCase() == robot.Name.toLowerCase();
        });
        var include_hit = filter.robot.includes.filter(function(inc){
            return inc.toLowerCase() == robot.Name.toLowerCase();
        });
        var include_condition = true;
        if(filter.robot.includes.length > 0){
            include_condition = include_hit.length > 0;
        }
        return robot.RobotEnvironments !== "" && exclude_hit.length == 0 && include_condition;
    };
    
    
    var group_class = function(robot, status){
        if(is_machine_exists(robot) && status.responsive){
            return "group_item_normal";
        }else{
            return "group_item_warn";
        }
    };
    
    var is_machine_exists = function(robot){
        return robot.MachineName != undefined && robot.RobotEnvironments != "";
    };
    
    var span_total_time = function(start, end){
        var diff = Math.abs(new Date(start) - new Date(end));
        return moment.duration(diff).humanize();
    };
    
    var get_time = function(date){
        return moment(date).format("HH:mm:ss");
    }
    
    
    var span_total_minutes = function(start, end){
        var diff = Math.abs(new Date(start) - new Date(end));
        return Math.ceil((diff/1000)/60);
    };
    
    var plus_usage = function(id, groups, job){
        var group = groups.filter(function(group){
            return group.id === id;
        })[0];
        
        if(job.State !== "Pending"){
            group.used_minutes = group.used_minutes + span_total_minutes(job.StartTime, job.EndTime);
        }
    };
    
    var scheduler_type_minutely = function(scheduler){
        var scheduler_type = JSON.parse(scheduler.StartProcessCronDetails).type;
        if(scheduler_type == 5){
            if(scheduler.StartProcessCronSummary.toLowerCase().includes("every 1 hours")){
                return true;
            }
        }
        return  scheduler_type == 0 || scheduler_type == 1;
    };
    
    var robot_states = function(robot){
        var unresponsive_list = ur_session_raw_data();
        var res_list = unresponsive_list.filter(function(unresponsive){
           return unresponsive.Robot.Name === robot.Name; 
        });
        if(res_list.length == 0){
            return {
                responsive: true,
                state: 'avaliable',
                last_update: 'now',
            }
        }else{
            return {
                responsive: false,
                state: get_state(res_list[0]),
                last_update: convert_utc_localtz(res_list[0].ReportingTime)
            }
        }
    };
    
    var get_state = function(session){
        if(session.IsUnresponsive){
            return "Unresponsive";
        }else{
            return session.State;
        }
    };
    
    var convert_utc_localtz = function(reporttime){
        return moment(reporttime).format("YYYY/MM/DD HH:mm:ss");
    };
    
    var render_group_content = function(groups){
        groups.forEach(function(group){
            var progress = Math.ceil(group.used_minutes * 100 / group.total_minutes);
            group.content = `<label>${group.robot_name}</label><br><progress max="100" value="${progress}"> ${progress}% </progress>`;
            
            if(group.status.responsive){
                group.title = `RobotName: ${group.robot_name}, \r\nMachineName: ${group.machine_name}, \r\nEnvironment ${group.environments}, \r\nType: ${group.type}, \r\nUsage: ${progress}%`;
            }else{
                group.title = `RobotName: ${group.robot_name}, \r\nMachineName: ${group.machine_name}, \r\nEnvironment ${group.environments}, \r\nType: ${group.type}, \r\nState: ${group.status.state} @ ${group.status.last_update} \r\nUsage: ${progress}%`;
            }
            
            group.order = -group.used_minutes;
        });
    };
    
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
    };
    
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
    
    /*********************
    *  DATA
    *********************/
    
    
    var schedule_raw_data = function(){
        return global_schedule_list;
    };
    
    var jobs_raw_data = function(){
        return global_job_list;
    };
    
    var robot_raw_data = function(){
        return global_robot_list;
    };
    
    var ur_session_raw_data = function(){
        return global_session_list;
    };
    
    var filter_raw_data = function(){
        return global_filter;
    };
    
    main();
});




