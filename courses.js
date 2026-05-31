// ===== HOW TO ADD LINKS =====
// Find the course name in courseResources below and paste your Google Drive link.
// Example:
// "ECE 401": {
//   "Course Outline": "https://drive.google.com/...",
//   "Past Questions": "https://drive.google.com/...",
//   ...
// }

var courseResources = {
  // Add your Google Drive links here per course. Example:
  // "ECE 301": {
  //   "Course Outline": "https://drive.google.com/your-link",
  //   "Lecture Material PDF": "",
  //   "Video Courses": "",
  //   "Past Questions": "",
  //   "Continuous Assessment": ""
  // },
};

var resourceTypes = [
  "Course Outline",
  "Lecture Material PDF",
  "Video Courses",
  "Past Questions",
  "Continuous Assessment"
];

function getResources(courseName) {
  return courseResources[courseName] || {};
}

var coursesDatabase = {
  "Faculty of Engineering": {
    "Electronic & Computer Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","ECE 101","PHY 101","CHM 101","PHY 107","ECE 105","CSC 101","GNS 101"],
        "Second Semester": ["MAT 102","MAT 108","ECE 102","ECE 104","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["ECE 201","ECE 203","ECE 207","ECE 211","MEE 203","MEE 205","MEE 207","MEE 209","ENT 211"],
        "Second Semester": ["ECE 202","ECE 206","ECE 208","ECE 210","ECE 220","MEE 202","MEE 204","CHE 206","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["ECE 301","ECE 303","ECE 305","ECE 307","ECE 309","ECE 319","ECE 321","ECE 351","MEE 301"],
        "Second Semester": ["ECE 302","ECE 306","ECE 308","ECE 310","ECE 312","ECE 314","ECE 316","ECE 320","ECE 322","ECE 350","ECE 351","ECE 352"]
      },
      "400 Level": {
        "First Semester": ["ECE 401","ECE 403","ECE 405","ECE 407","ECE 409","ECE 411","ECE 413"],
        "Second Semester": ["ECE 402","ECE 404","ECE 406","ECE 408","ECE 410","ECE 412","ECE 414"]
      },
      "500 Level": {
        "First Semester": ["ECE 501","ECE 503","ECE 505","ECE 507","ECE 509","ECE 511"],
        "Second Semester": ["ECE 502","ECE 504","ECE 506","ECE 508","ECE 510","ECE 512"]
      }
    },
    "Mechanical Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","MEE 101","PHY 101","CHM 101","PHY 107","MEE 105","CSC 101","GNS 101"],
        "Second Semester": ["MAT 102","MAT 108","MEE 102","MEE 104","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["MEE 201","MEE 203","MEE 205","MEE 207","MEE 209","MEE 211","ENT 211"],
        "Second Semester": ["MEE 202","MEE 204","MEE 206","MEE 208","MEE 210","MEE 212","CHE 206","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["ECE 351","MEE 301","MEE 305","MEE 351","MEE 353","MEE 355","MEE 357"],
        "Second Semester": ["ECE 352", "ECE 316","CHE 352", "MEE 354","MEE 352","ECE 351","ENT 312","GNS 312"]
      },
      "400 Level": {
        "First Semester": ["MEE 401","MEE 403","MEE 405","MEE 407","MEE 409","MEE 411","MEE 413"],
        "Second Semester": ["MEE 402","MEE 404","MEE 406","MEE 408","MEE 410","MEE 412","MEE 414"]
      },
      "500 Level": {
        "First Semester": ["MEE 501","MEE 503","MEE 505","MEE 507","MEE 509","MEE 511"],
        "Second Semester": ["MEE 502","MEE 504","MEE 506","MEE 508","MEE 510","MEE 512"]
      }
    },
    "Industrial & Petroleum Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","IPE 101","PHY 101","CHM 101","PHY 107","IPE 105","CSC 101","GNS 101"],
        "Second Semester": ["MAT 102","MAT 108","IPE 102","IPE 104","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["IPE 201","IPE 203","IPE 205","IPE 207","IPE 209","MEE 203","MEE 205","ENT 211"],
        "Second Semester": ["IPE 202","IPE 204","IPE 206","IPE 208","MEE 202","CHE 206","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["IPE 301","IPE 311","IPE 317","ECE 351","MEE 301","MEE 351"],
        "Second Semester": ["ECE 352","ECE 351", "ECE 316", "IPE","CHE 352", "MEE 352","ENT 312","GNS 312"]
      },
      "400 Level": {
        "First Semester": ["IPE 401","IPE 403","IPE 405","IPE 407","IPE 409","IPE 411","IPE 413"],
        "Second Semester": ["IPE 402","IPE 404","IPE 406","IPE 408","IPE 410","IPE 412","IPE 414"]
      },
      "500 Level": {
        "First Semester": ["IPE 501","IPE 503","IPE 505","IPE 507","IPE 509","IPE 511"],
        "Second Semester": ["IPE 502","IPE 504","IPE 506","IPE 508","IPE 510","IPE 512"]
      }
    },
    "Chemical & Polymer Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","CPE 101","PHY 101","CHM 101","PHY 107","CPE 105","CSC 101","GNS 101"],
        "Second Semester": ["MAT 102","MAT 108","CPE 102","CPE 104","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["CHE 201","CHE 203","ECE 203","ECE 211","MEE 203","MEE 205","MEE 209","ENT 211"],
        "Second Semester": ["CHE 202","CHE 204","CHE 206","CHE 208","MEE 202","MEE 204","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["CHE 301","CHE 303","CHE 305","CHE 307","CHE 309","CHE 311","CHE 313","CHE 315","ECE 351"],
        "Second Semester": ["ECE 352","ECE 351", "CHE 314","CHE 312","MEE 352","ENT 312","GNS 312"]
      },
      "400 Level": {
        "First Semester": ["CPE 401","CPE 403","CPE 405","CPE 407","CPE 409","CPE 411","CPE 413"],
        "Second Semester": ["CPE 402","CPE 404","CPE 406","CPE 408","CPE 410","CPE 412","CPE 414"]
      }
    },
    "Civil Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","CVE 101","PHY 101","CHM 101","PHY 107","CVE 105","CSC 101","GNS 101"],
        "Second Semester": ["MAT 102","MAT 108","CVE 102","CVE 104","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["CVE 201","CVE 203","CVE 205","CVE 207","MEE 203","MEE 205","MEE 209","ENT 211"],
        "Second Semester": ["CVE 202","CVE 204","CVE 206","CVE 208","MEE 202","MEE 204","CHE 206","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["CVE 301","CVE 307","CVE 309","ECE 351","MEE 301","MEE 351"],
        "Second Semester": ["ECE 352","ECE 351" "CHE 352","CVE 304","CVE 308","CVE 308","CVE 310","ENT 312","GNS 312"]
      },
      "400 Level": {
        "First Semester": ["CVE 401","CVE 403","CVE 405","CVE 407","CVE 409","CVE 411","CVE 413"],
        "Second Semester": ["CVE 402","CVE 404","CVE 406","CVE 408","CVE 410","CVE 412","CVE 414"]
      },
      "500 Level": {
        "First Semester": ["CVE 501","CVE 503","CVE 505","CVE 507","CVE 509","CVE 511"],
        "Second Semester": ["CVE 502","CVE 504","CVE 506","CVE 508","CVE 510","CVE 512"]
      }
    },
    "Aerospace Engineering": {
      "100 Level": {
        "First Semester": ["MAT 101","MAT 161","PHY 101","CHM 101","PHY 107","PHY 103","CSC 101","GNS 111","MEE 101"],
        "Second Semester": ["MAT 102","MAT 108","AAE 102","CHM 102","CHM 108","PHY 102","PHY 108","GNS 104","GNS 112"]
      },
      "200 Level": {
        "First Semester": ["ASE 201","ECE 203","ECE 211","ASE 207","MEE 203","MEE 205","MEE 207","MEE 209","ENT 211"],
        "Second Semester": ["ASE 202","ASE 204","MEE 202","MEE 204","MEE 208","ECE 202","ECE 210","CHE 206","GNS 212"]
      },
      "300 Level": {
        "First Semester": ["MEE 301","MEE 351","ECE 351"],
        "Second Semester": ["ASE 363","ASE 366 ","ECE 351","ENT 312","GNS 312"]
      },
      "400 Level": {
        "First Semester": ["ASE 401","ASE 403","ASE 405","ASE 407","ASE 409","ASE 411","ASE 413"],
        "Second Semester": ["ASE 402","ASE 404","ASE 406","ASE 408","ASE 410","ASE 412","ASE 414"]
      },
      "500 Level": {
        "First Semester": ["ASE 501","ASE 503","ASE 505","ASE 507","ASE 509","ASE 511"],
        "Second Semester": ["ASE 502","ASE 504","ASE 506","ASE 508","ASE 510","ASE 512"]
      }
    }
  }
};

// Expose to window so Firebase module scripts can access these
window.coursesDatabase = coursesDatabase;
window.courseResources = courseResources;
window.resourceTypes = resourceTypes;
window.getResources = getResources;
