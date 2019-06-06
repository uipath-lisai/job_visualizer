var group_example = function(){
  // create groups to highlight groupUpdate
  var groups = new vis.DataSet([
    {id: 1, content: 'Machine 1'},
    {id: 2, content: 'Machine 2'},
    {id: 3, content: 'Machine 3'}  
  ]);

  var point_style = {
      p1: "border-color: blue"
  }

  // create a DataSet with items
  var items = new vis.DataSet([
    {id: 1, content: 'Job1', type: 'range', start: '2010-08-23T00:00:00', end: '2010-08-23T23:59:00', group: 1},
    {id: 2, content: 'Job2', type: 'range', start: '2010-08-24T00:00:00', end: '2010-08-24T23:59:00', group: 2},
    {id: 3, content: 'Job3', type: 'range', start: '2010-08-25T00:00:00', end: '2010-08-25T23:59:00', group: 1},
    {id: 4, content: 'Job4', start: '2010-08-26', end: '2010-09-02', group: 2},
    {id: 5, content: 'Job5', start: '2010-08-28', end: '2010-08-29', group: 1},
    {id: 7, content: 'Job7', start: '2010-08-30', end: '2010-09-03', group: 1},
    {id: 8, content: 'Job8', start: '2010-09-04T12:00:00', end: '2010-09-04T24:00:00', group: 2},
    {id: 10, content: 'Sch1', type: 'point', start: '2010-08-23T00:00:00', style: point_style.p1, group: 1},
    {id: 11, content: 'Sch2', type: 'point', start: '2010-08-27T00:00:00', group: 1}
  ]);

  var container = document.getElementById('visualization');
  var options = {
    editable: false,   // default for all items
    horizontalScroll: false
  };

  var timeline = new vis.Timeline(container, items, groups, options);
};

var nest_group_example = function(){

  var now = moment().minutes(0).seconds(0).milliseconds(0);
  var itemCount = 60;

  // create a data set with groups
  var groups = new vis.DataSet();

  groups.add([
    {
      id: 1,
      content: "Lee",
      nestedGroups: [11,12,13]
    },
    {
      id: 2,
      content: "invisible group",
      visible: false
    },
    {
      id: 3,
      content: "John",
      nestedGroups: [14],
      showNested: false
    },
    {
      id: 4,
      content: "Alson"
    },

  ]);

  groups.add([
    {
      id: 11,
      content: "cook",
    },
    {
      id: 12,
      content: "shop",
    },
    {
      id: 13,
      content: "clean house",
    },
    {
      id: 14,
      content: "wash dishes",
    }
  ]);

  // create a dataset with items
  var items = new vis.DataSet();
  var groupIds = groups.getIds();
    var types = [ 'box', 'point', 'range', 'background']
  for (var i = 0; i < itemCount; i++) {
    var start = now.clone().add(Math.random() * 200, 'hours');
    var end = start.clone().add(2, 'hours');
    var randomGroupId = groupIds[Math.floor(Math.random() * groupIds.length)];
    var type = types[Math.floor(4 * Math.random())]

    items.add({
      id: i,
      group: randomGroupId,
      content: 'item ' + i,
      start: start,
      end: end,
      type: type
    });
  }

  // create visualization
  var container = document.getElementById('visualization');
  var options = {
    groupOrder: 'content'  // groupOrder can be a property name or a sorting function
  };

  var timeline = new vis.Timeline(container, items, groups, options);
    
};

group_example();
//nest_group_example();