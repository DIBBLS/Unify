// ===== HOW TO ADD LINKS =====
 // Find the course name in courseResources below and paste your Google Drive link. 

 // Example: // "ECE 401": { 

 // "Course Outline": "https://drive.google.com/...", 

// "Past Questions": "https://drive.google.com/...",
// ...
 // } 


 var courseResources = { 
 // Add your Google Drive links here per course. Example: 
 // "ECE 301": { 
 // "Course Outline": "https://drive.google.com/your-link", 
 // "Lecture Material PDF": "", 
 // "Video Courses": "", 

 // "Past Questions": "",
  // "Continuous Assessment": "" 
  // }, 
  }; 

  var resourceTypes = [ 
  "Course Outline", 
  "Lecture Material PDF", 
  "Video Courses", "Past Questions", 
  "Continuous Assessment" 
  ];
  
  function getResources(courseName) { return courseResources[courseName] || {}; 

  }



var coursesDatabase = {
 "Faculty of Environmental Science": {
  "Architecture": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Building": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Environmental Management": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Estate Management": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Fine Art": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Industrial Design": {
    "100 Level": {
      "First Semester": [
        "ARC 105",
        "CHM 101",
        "CHM 107",
        "GNS 111",
        "IDD 101",
        "IDD 103",
        "IDD 105",
        "IDD 107",
        "IDD 109",
        "MAT 101",
        "MEE 105"
      ],
      "Second Semester": [
        "ARC 106",
        "CHM 102",
        "GNS 104",
        "GNS 112",
        "IDD 102",
        "IDD 104",
        "IDD 106",
        "IDD 108",
        "IDD 110",
        "MAT 102"
      ]
    },
    "200 Level": {
      "First Semester": [
        "ARC 225",
        "ENT 211",
        "IDD 201",
        "IDD 203",
        "IDD 205",
        "IDD 207",
        "IDD 211",
        "IDD 217",
        "MEE 209"
      ],
      "Second Semester": [
        "AAC 222",
        "GNS 212",
        "IDD 202",
        "IDD 204",
        "IDD 206",
        "IDD 208",
        "IDD 212",
        "IDD 218",
        "MEE 202",
        "MEE 204",
        "TNL 207"
      ]
    },
    "300 Level": {
      "First Semester": [
        "IDD 313",
        "IDD 317",
        "IDD 319",
        "IDD 323",
        "IDD 327",
        "IDD 331",
        "IDD 333",
        "IDD 337",
        "IDD 341",
        "PED 301",
        "PED 303"
      ],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Quantity Surveying": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Survey and Geoinformatics": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  },

  "Urban and Regional Planning": {
    "100 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "200 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "300 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "400 Level": {
      "First Semester": [],
      "Second Semester": []
    },
    "500 Level": {
      "First Semester": [],
      "Second Semester": []
    }
  }
};