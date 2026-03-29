// ═══════════════════════════════════════════════════════════════
// courseContent.js — Unify Learning Library
// Week/topic structure for all LASU Faculty of Engineering courses.
// Shared courses (ECE 351, MEE 301, CHE 206 etc.) are defined once
// and referenced by all departments that offer them.
//
// TO ADD CONTENT for a topic:
//   Find the course entry, find the week, find the subtopic object.
//   Fill in: explanation, examples[], examQuestions[], summary[]
//   Leave fields empty ('') if not yet reviewed by coordinator.
// ═══════════════════════════════════════════════════════════════

const UNIFY_COURSE_CONTENT = {

  // ── SHARED COURSES (offered across multiple departments) ─────

  "MAT 101": {
    title: "Mathematics I",
    weeks: [
      { week:1, topic:"Sets, Logic & Number Systems", subtopics:["Set Theory & Operations","Logic & Proofs","Number Systems"], time:14 },
      { week:2, topic:"Functions & Graphs", subtopics:["Types of Functions","Graphs & Transformations"], time:12 },
      { week:3, topic:"Limits & Continuity", subtopics:["Definition of a Limit","Continuity & Discontinuity"], time:13 },
      { week:4, topic:"Differentiation I", subtopics:["First Principles","Rules of Differentiation"], time:14 },
      { week:5, topic:"Differentiation II", subtopics:["Chain Rule, Product & Quotient","Implicit Differentiation"], time:13 },
      { week:6, topic:"Applications of Differentiation", subtopics:["Maxima & Minima","Rates of Change"], time:12 },
      { week:7, topic:"Integration I", subtopics:["Indefinite Integrals","Basic Rules"], time:13 },
      { week:8, topic:"Integration II", subtopics:["Definite Integrals","Area Under a Curve"], time:13 },
      { week:9, topic:"Integration Techniques", subtopics:["Substitution","Integration by Parts"], time:14 },
      { week:10, topic:"Sequences & Series", subtopics:["Arithmetic & Geometric Sequences","Convergence"], time:12 },
      { week:11, topic:"Matrices & Determinants", subtopics:["Matrix Operations","Determinants & Inverse"], time:14 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Question Walkthrough","Key Formula Sheet"], time:10 },
    ]
  },

  "MAT 102": {
    title: "Mathematics II",
    weeks: [
      { week:1, topic:"Complex Numbers", subtopics:["Algebra of Complex Numbers","Argand Diagram"], time:13 },
      { week:2, topic:"Partial Differentiation", subtopics:["First & Second Order Partials","Mixed Partials"], time:14 },
      { week:3, topic:"Multiple Integrals", subtopics:["Double Integrals","Change of Order"], time:14 },
      { week:4, topic:"Ordinary Differential Equations I", subtopics:["First Order ODEs","Separable Equations"], time:14 },
      { week:5, topic:"ODEs II — Linear Equations", subtopics:["Integrating Factor","Bernoulli Equation"], time:14 },
      { week:6, topic:"Second Order ODEs", subtopics:["Homogeneous Equations","Particular Integrals"], time:15 },
      { week:7, topic:"Laplace Transform I", subtopics:["Definition & Standard Transforms","Properties"], time:14 },
      { week:8, topic:"Laplace Transform II", subtopics:["Inverse Laplace","Solving ODEs"], time:14 },
      { week:9, topic:"Vector Algebra", subtopics:["Vectors & Operations","Dot & Cross Product"], time:12 },
      { week:10, topic:"Vector Calculus", subtopics:["Gradient, Divergence, Curl","Line Integrals"], time:14 },
      { week:11, topic:"Fourier Series", subtopics:["Fourier Coefficients","Even & Odd Functions"], time:13 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Question Walkthrough","Key Formula Sheet"], time:10 },
    ]
  },

  "MAT 161": {
    title: "Further Mathematics",
    weeks: [
      { week:1, topic:"Trigonometry", subtopics:["Identities & Formulae","Inverse Trig Functions"], time:12 },
      { week:2, topic:"Coordinate Geometry", subtopics:["Lines & Circles","Conic Sections"], time:12 },
      { week:3, topic:"Calculus Review", subtopics:["Differentiation Review","Integration Review"], time:12 },
      { week:4, topic:"Binomial Theorem", subtopics:["Binomial Expansion","Applications"], time:11 },
      { week:5, topic:"Probability", subtopics:["Basic Probability","Conditional Probability"], time:12 },
      { week:6, topic:"Statistics", subtopics:["Descriptive Statistics","Distributions"], time:12 },
      { week:7, topic:"Vectors in 2D & 3D", subtopics:["Vector Representation","Applications"], time:11 },
      { week:8, topic:"Matrices", subtopics:["Matrix Algebra","Systems of Equations"], time:12 },
      { week:9, topic:"Mechanics I", subtopics:["Newton's Laws","Kinematics"], time:12 },
      { week:10, topic:"Mechanics II", subtopics:["Work & Energy","Momentum"], time:12 },
      { week:11, topic:"Further Integration", subtopics:["Volumes of Revolution","Arc Length"], time:13 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Summary Notes"], time:10 },
    ]
  },

  "PHY 101": {
    title: "General Physics I",
    weeks: [
      { week:1, topic:"Measurement & Units", subtopics:["SI Units & Dimensions","Significant Figures & Errors"], time:11 },
      { week:2, topic:"Vectors & Scalars", subtopics:["Vector Operations","Resolution of Vectors"], time:12 },
      { week:3, topic:"Kinematics", subtopics:["Linear Motion","Projectile Motion"], time:13 },
      { week:4, topic:"Newton's Laws", subtopics:["First & Second Law","Third Law & Applications"], time:13 },
      { week:5, topic:"Work, Energy & Power", subtopics:["Work-Energy Theorem","Conservation of Energy"], time:12 },
      { week:6, topic:"Momentum & Collisions", subtopics:["Linear Momentum","Elastic & Inelastic Collisions"], time:12 },
      { week:7, topic:"Circular Motion", subtopics:["Centripetal Acceleration","Banking & Friction"], time:12 },
      { week:8, topic:"Gravitation", subtopics:["Newton's Law of Gravitation","Orbital Mechanics"], time:12 },
      { week:9, topic:"Simple Harmonic Motion", subtopics:["SHM Equations","Springs & Pendulums"], time:13 },
      { week:10, topic:"Properties of Matter", subtopics:["Elasticity & Stress","Fluids & Pressure"], time:12 },
      { week:11, topic:"Waves", subtopics:["Wave Motion","Sound & Resonance"], time:12 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Formula Review"], time:10 },
    ]
  },

  "PHY 102": {
    title: "General Physics II",
    weeks: [
      { week:1, topic:"Electrostatics I", subtopics:["Electric Charge & Coulomb's Law","Electric Field"], time:13 },
      { week:2, topic:"Electrostatics II", subtopics:["Electric Potential","Capacitance"], time:13 },
      { week:3, topic:"Current Electricity", subtopics:["Current, Resistance & Ohm's Law","Power & Energy"], time:13 },
      { week:4, topic:"DC Circuits", subtopics:["Kirchhoff's Laws","Series & Parallel Circuits"], time:14 },
      { week:5, topic:"Magnetic Fields", subtopics:["Magnetic Force & Field","Biot-Savart Law"], time:13 },
      { week:6, topic:"Electromagnetic Induction", subtopics:["Faraday's Law","Lenz's Law"], time:13 },
      { week:7, topic:"AC Circuits", subtopics:["AC Fundamentals","Impedance & Resonance"], time:14 },
      { week:8, topic:"Optics I", subtopics:["Reflection & Refraction","Mirrors & Lenses"], time:12 },
      { week:9, topic:"Optics II", subtopics:["Interference","Diffraction"], time:12 },
      { week:10, topic:"Modern Physics I", subtopics:["Photoelectric Effect","Wave-Particle Duality"], time:12 },
      { week:11, topic:"Modern Physics II", subtopics:["Atomic Models","Nuclear Physics"], time:12 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Formula Review"], time:10 },
    ]
  },

  "CHM 101": {
    title: "General Chemistry I",
    weeks: [
      { week:1, topic:"Atomic Structure", subtopics:["Atomic Theory","Electronic Configuration"], time:12 },
      { week:2, topic:"Chemical Bonding", subtopics:["Ionic & Covalent Bonding","Hybridisation"], time:13 },
      { week:3, topic:"Stoichiometry", subtopics:["Mole Concept","Chemical Equations"], time:13 },
      { week:4, topic:"Gases", subtopics:["Ideal Gas Law","Kinetic Theory"], time:13 },
      { week:5, topic:"Thermochemistry", subtopics:["Enthalpy & Hess's Law","Calorimetry"], time:13 },
      { week:6, topic:"Chemical Equilibrium", subtopics:["Equilibrium Constant","Le Chatelier's Principle"], time:13 },
      { week:7, topic:"Acids & Bases", subtopics:["pH & Buffers","Titration"], time:12 },
      { week:8, topic:"Electrochemistry", subtopics:["Electrochemical Cells","Faraday's Laws"], time:13 },
      { week:9, topic:"Chemical Kinetics", subtopics:["Rate Laws","Activation Energy"], time:13 },
      { week:10, topic:"Organic Chemistry I", subtopics:["Hydrocarbons","Functional Groups"], time:13 },
      { week:11, topic:"Organic Chemistry II", subtopics:["Reactions & Mechanisms","Polymers"], time:13 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Summary Notes"], time:10 },
    ]
  },

  "CSC 101": {
    title: "Introduction to Computing",
    weeks: [
      { week:1, topic:"History & Fundamentals", subtopics:["Computer History","Hardware & Software"], time:10 },
      { week:2, topic:"Number Systems", subtopics:["Binary, Octal, Hex","Conversions"], time:11 },
      { week:3, topic:"Logic Gates & Boolean Algebra", subtopics:["Basic Gates","Boolean Simplification"], time:12 },
      { week:4, topic:"Computer Organisation", subtopics:["CPU Architecture","Memory Hierarchy"], time:12 },
      { week:5, topic:"Operating Systems", subtopics:["OS Functions","Process Management"], time:11 },
      { week:6, topic:"Programming Fundamentals", subtopics:["Algorithms & Flowcharts","Pseudocode"], time:12 },
      { week:7, topic:"Introduction to Programming", subtopics:["Variables & Data Types","Control Structures"], time:13 },
      { week:8, topic:"Functions & Arrays", subtopics:["Functions","Arrays & Strings"], time:13 },
      { week:9, topic:"Data Structures", subtopics:["Stacks & Queues","Linked Lists"], time:13 },
      { week:10, topic:"Databases", subtopics:["Database Concepts","SQL Basics"], time:12 },
      { week:11, topic:"Networks & Internet", subtopics:["Network Basics","Internet & Web"], time:11 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Summary"], time:10 },
    ]
  },

  "GNS 101": {
    title: "Use of English & Communication I",
    weeks: [
      { week:1, topic:"Communication Skills", subtopics:["Types of Communication","Barriers to Communication"], time:10 },
      { week:2, topic:"Reading Comprehension", subtopics:["Reading Strategies","Comprehension Exercises"], time:10 },
      { week:3, topic:"Essay Writing I", subtopics:["Structure of an Essay","Introduction & Conclusion"], time:10 },
      { week:4, topic:"Essay Writing II", subtopics:["Argumentative Essays","Expository Essays"], time:10 },
      { week:5, topic:"Summary Writing", subtopics:["Techniques for Summarising","Practice Exercises"], time:10 },
      { week:6, topic:"Grammar I", subtopics:["Parts of Speech","Sentence Structure"], time:10 },
      { week:7, topic:"Grammar II", subtopics:["Tenses & Concord","Punctuation"], time:10 },
      { week:8, topic:"Vocabulary", subtopics:["Word Formation","Synonyms & Antonyms"], time:10 },
      { week:9, topic:"Oral Communication", subtopics:["Public Speaking","Presentations"], time:10 },
      { week:10, topic:"Technical Writing", subtopics:["Reports","Memos & Letters"], time:10 },
      { week:11, topic:"Library & Research Skills", subtopics:["Using the Library","Citation & Referencing"], time:10 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Summary"], time:10 },
    ]
  },

  "ENT 211": {
    title: "Entrepreneurship",
    weeks: [
      { week:1, topic:"Introduction to Entrepreneurship", subtopics:["What is Entrepreneurship?","The Entrepreneurial Mindset"], time:10 },
      { week:2, topic:"Opportunity Recognition", subtopics:["Identifying Opportunities","Market Research Basics"], time:10 },
      { week:3, topic:"Business Planning", subtopics:["The Business Plan","Financial Projections"], time:11 },
      { week:4, topic:"Financing a Business", subtopics:["Sources of Finance","Pitching to Investors"], time:11 },
      { week:5, topic:"Marketing", subtopics:["Marketing Mix","Building a Brand"], time:10 },
      { week:6, topic:"Operations & Management", subtopics:["Operations Basics","Team & Leadership"], time:10 },
      { week:7, topic:"Legal & Regulatory Framework", subtopics:["Business Registration in Nigeria","Contracts & IP"], time:10 },
      { week:8, topic:"Innovation & Technology", subtopics:["Innovation Processes","Tech-Driven Business"], time:11 },
      { week:9, topic:"Social Entrepreneurship", subtopics:["Impact vs Profit","Case Studies"], time:10 },
      { week:10, topic:"Growing a Business", subtopics:["Scaling Strategies","Challenges of Growth"], time:10 },
      { week:11, topic:"Pitch Workshop", subtopics:["Structuring Your Pitch","Practice & Feedback"], time:11 },
      { week:12, topic:"Revision & Presentations", subtopics:["Group Presentations","Exam Prep"], time:10 },
    ]
  },

  // ── ECE 351: Shared across ECE, MEE, CVE, IPE, ASE ──────────
  "ECE 351": {
    title: "Electrical Technology",
    weeks: [
      { week:1, topic:"DC Circuit Analysis", subtopics:["Ohm's Law & KVL/KCL","Series & Parallel Circuits"], time:13 },
      { week:2, topic:"Network Theorems", subtopics:["Thevenin & Norton","Superposition"], time:13 },
      { week:3, topic:"Magnetic Circuits", subtopics:["MMF, Flux & Reluctance","B-H Curves"], time:13 },
      { week:4, topic:"Transformers", subtopics:["Ideal Transformer","Transformer Efficiency"], time:13 },
      { week:5, topic:"AC Fundamentals", subtopics:["Phasors & RMS Values","Power Factor"], time:14 },
      { week:6, topic:"AC Circuit Analysis", subtopics:["Series & Parallel AC","Resonance"], time:14 },
      { week:7, topic:"Three-Phase Systems", subtopics:["Star & Delta Connection","Power in 3-Phase"], time:14 },
      { week:8, topic:"DC Machines", subtopics:["DC Generator","DC Motor"], time:13 },
      { week:9, topic:"AC Machines — Induction Motor", subtopics:["Construction & Working","Slip & Torque"], time:13 },
      { week:10, topic:"AC Machines — Synchronous", subtopics:["Synchronous Generator","Synchronous Motor"], time:13 },
      { week:11, topic:"Power Electronics Basics", subtopics:["Diodes & Rectifiers","Transistor Switches"], time:12 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Key Formulas"], time:10 },
    ]
  },

  "MEE 301": {
    title: "Engineering Mathematics III",
    weeks: [
      { week:1, topic:"Partial Differential Equations", subtopics:["Classification","First Order PDEs"], time:14 },
      { week:2, topic:"PDEs — Heat Equation", subtopics:["Solution Methods","Boundary Conditions"], time:14 },
      { week:3, topic:"PDEs — Wave Equation", subtopics:["D'Alembert Solution","Applications"], time:14 },
      { week:4, topic:"PDEs — Laplace Equation", subtopics:["Laplace Equation","Potential Problems"], time:14 },
      { week:5, topic:"Numerical Methods I", subtopics:["Bisection & Newton-Raphson","Fixed Point Iteration"], time:13 },
      { week:6, topic:"Numerical Methods II", subtopics:["Numerical Integration","Trapezoidal & Simpson"], time:13 },
      { week:7, topic:"Numerical ODEs", subtopics:["Euler's Method","Runge-Kutta Methods"], time:14 },
      { week:8, topic:"Probability & Statistics I", subtopics:["Probability Distributions","Normal Distribution"], time:13 },
      { week:9, topic:"Probability & Statistics II", subtopics:["Hypothesis Testing","Regression Analysis"], time:13 },
      { week:10, topic:"Optimisation", subtopics:["Linear Programming","Simplex Method"], time:13 },
      { week:11, topic:"Graph Theory Basics", subtopics:["Graphs & Trees","Applications"], time:12 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Formula Sheet"], time:10 },
    ]
  },

  "MEE 351": {
    title: "Fluid Mechanics",
    weeks: [
      { week:1, topic:"Fluid Properties", subtopics:["Density, Viscosity & Surface Tension","Pressure & Pascal's Law"], time:12 },
      { week:2, topic:"Fluid Statics", subtopics:["Hydrostatic Pressure","Forces on Submerged Surfaces"], time:13 },
      { week:3, topic:"Kinematics of Fluid Flow", subtopics:["Types of Flow","Streamlines & Pathlines"], time:13 },
      { week:4, topic:"Continuity Equation", subtopics:["Conservation of Mass","Applications"], time:13 },
      { week:5, topic:"Bernoulli's Equation", subtopics:["Derivation & Applications","Venturi & Pitot Tube"], time:14 },
      { week:6, topic:"Momentum Equation", subtopics:["Linear Momentum in Fluids","Applications"], time:13 },
      { week:7, topic:"Viscous Flow", subtopics:["Laminar & Turbulent Flow","Reynolds Number"], time:13 },
      { week:8, topic:"Pipe Flow", subtopics:["Head Losses in Pipes","Darcy-Weisbach Equation"], time:14 },
      { week:9, topic:"Boundary Layer Theory", subtopics:["Boundary Layer Development","Drag & Lift"], time:13 },
      { week:10, topic:"Open Channel Flow", subtopics:["Manning's Equation","Critical Flow"], time:13 },
      { week:11, topic:"Dimensional Analysis", subtopics:["Buckingham Pi Theorem","Similarity Laws"], time:13 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Questions","Key Formulas"], time:10 },
    ]
  },

  "CHE 206": {
    title: "Fundamentals of Thermodynamics",
    weeks: [
      {
        week:1, topic:"Definitions, Laws & Approaches",
        subtopics:["Defining Thermodynamics","The Four Laws"],
        time:12,
        summary:"By the end of this week you should be able to define thermodynamics, distinguish between classical and statistical approaches, and state all four laws with the property each one defines.",
        resources:{ notes:"Coursecontents/CHE 206/W1.html" },
        pastQuestions:[
          { year:"2017/18", text:"Define thermodynamics and state the two approaches used to study it. Distinguish clearly between them." },
          { year:"2015/16", text:"State the First and Second Laws of Thermodynamics." },
          { year:"2016/17", text:"What thermodynamic property does each of the four laws define?" },
        ],
        practiceQuestions:[
          { q:"State the four laws of thermodynamics and name the property each law defines.", a:"Zeroth → Temperature. First → Energy (conservation). Second → Entropy (direction). Third → Absolute value of Entropy." },
          { q:"A cup of hot coffee left in a room gradually cools. Which law explains why the reverse never happens?", a:"The Second Law — entropy of an isolated system always increases. Spontaneous heat flow is always from hot to cold, never the reverse." },
          { q:"Distinguish between classical and statistical thermodynamics.", a:"Classical: macroscopic — deals with bulk measurable properties (T, P, V) without atomic knowledge. Statistical: microscopic — explains bulk properties from individual particle behaviour." },
        ],
        content:{
          "Defining Thermodynamics": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W1.html" },
          "The Four Laws": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W1.html" }
        }
      },
      {
        week:2, topic:"Systems, States & Gibbs Phase Rule",
        subtopics:["Systems, Boundaries & Types","Gibbs Phase Rule"],
        time:13,
        summary:"This week defines the vocabulary used throughout the course — what a system is, what types exist, how to define a thermodynamic state, and how to count degrees of freedom using Gibbs Phase Rule.",
        resources:{ notes:"Coursecontents/CHE 206/W2.html" },
        pastQuestions:[
          { year:"2017/18", text:"Define the following processes: isothermal, adiabatic, isochoric, isobaric, polytropic." },
          { year:"2015/16", text:"Define the following processes: isothermal, adiabatic, isochoric, isobaric, polytropic." },
          { year:"2022/23", text:"State Gibbs Phase Rule and determine the degrees of freedom for: (i) liquid water in equilibrium with its vapour (ii) liquid water with water vapour, hydrogen and oxygen." },
        ],
        practiceQuestions:[
          { q:"State Gibbs Phase Rule and define each term. Calculate F for liquid water in equilibrium with its vapour only.", a:"F = 2 − π + N. N=1, π=2 → F = 1. One degree of freedom: fix T and P is determined, or vice versa." },
          { q:"A rigid insulated tank contains nitrogen. Is this system open, closed, isolated, or adiabatic?", a:"Isolated — no energy and no mass crosses the boundary. Rigid means no boundary work. Insulated means no heat transfer." },
          { q:"At the triple point of water, all three phases coexist. Apply Gibbs Phase Rule and explain why the triple point is a unique condition.", a:"N=1, π=3 → F = 2−3+1 = 0. Zero degrees of freedom: T and P are completely fixed. It cannot occur at any other T or P." },
        ],
        content:{
          "Systems, Boundaries & Types": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W2.html" },
          "Gibbs Phase Rule": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W2.html" }
        }
      },
      {
        week:3, topic:"Properties & First Law Mathematics",
        subtopics:["Intensive vs Extensive Properties","First Law — The Rigid Tank Problem"],
        time:14,
        summary:"This week establishes what thermodynamic properties are, how to classify them as intensive or extensive, and how the First Law is applied mathematically to real systems. The rigid tank problem appears in every exam.",
        resources:{ notes:"Coursecontents/CHE 206/W3.html" },
        pastQuestions:[
          { year:"2022/23", text:"A rigid insulated tank of 300 litres contains nitrogen at 450K, 2 bar. An electrical resistor heats it to 550K. Find work done and final pressure." },
          { year:"2015/16", text:"Differentiate between intensive and extensive properties with examples." },
          { year:"2022/23", text:"Why is thermodynamic property of a fluid important in Engineering Thermodynamics?" },
        ],
        practiceQuestions:[
          { q:"Classify each as intensive or extensive: temperature, total volume, pressure, total entropy, density, specific enthalpy.", a:"Intensive: temperature, pressure, density, specific enthalpy. Extensive: total volume, total entropy." },
          { q:"A rigid insulated tank of 200L contains nitrogen at 400K and 1.5 bar. A resistor heats it to 500K. Find work done and final pressure. Use Cv = 5R/2.", a:"n = P₁V/RT₁ = (1.5×10⁵ × 0.2)/(8.3144 × 400) = 9.02 mol. W = nCvΔT = 9.02 × (5/2 × 8.3144) × 100 = 18,739 J ≈ 18.7 kJ. P₂ = P₁ × T₂/T₁ = 1.5 × 500/400 = 1.875 bar." },
          { q:"Explain why boundary work W = 0 for a rigid tank, even when electrical energy is added.", a:"Boundary work = P×ΔV. A rigid tank has constant volume so ΔV = 0, hence W_boundary = 0. Electrical work is a different form of energy input — it raises internal energy directly." },
        ],
        content:{
          "Intensive vs Extensive Properties": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W3.html" },
          "First Law — The Rigid Tank Problem": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W3.html" }
        }
      },
      {
        week:4, topic:"Four Fundamental Property Relations",
        subtopics:["Deriving U, H, A, G Relations"],
        time:14,
        summary:"These four equations are the mathematical heart of thermodynamics. Every derivation in this course starts from these four. Deriving them from scratch is a core exam skill.",
        resources:{ notes:"Coursecontents/CHE 206/W4.html" },
        pastQuestions:[
          { year:"2022/23", text:"The fundamental property relations are given. Derive them from the first and second laws." },
          { year:"2015/16", text:"Derive the fundamental property relations from the first and second laws." },
          { year:"2016/17", text:"Show how d(nU) = Td(nS) − Pd(nV) is derived from the first and second laws." },
        ],
        practiceQuestions:[
          { q:"Starting from the first and second laws, derive dU = TdS − PdV. State all assumptions.", a:"From 1st Law: dU = dQ − PdV. From 2nd Law (reversible): dQ = TdS. Substituting: dU = TdS − PdV. Assumes reversible process." },
          { q:"Define Gibbs energy G and derive dG = VdP − SdT from dH = TdS + VdP.", a:"G = H − TS. dG = dH − TdS − SdT = TdS + VdP − TdS − SdT = VdP − SdT." },
          { q:"State what each of the four functions U, H, A, G represents physically.", a:"U: total stored energy. H = U+PV: heat at constant P. A = U−TS: max work at const T,V. G = H−TS: max non-expansion work at const T,P; equilibrium criterion." },
        ],
        content:{
          "Deriving U, H, A, G Relations": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W4.html" }
        }
      },
      {
        week:5, topic:"Maxwell's Equations",
        subtopics:["Criterion of Exactness & Maxwell Equations"],
        time:14,
        summary:"Maxwell's equations let you swap unmeasurable quantities like entropy changes for measurable ones like pressure and volume. They are derived mechanically from the four property relations using one mathematical rule.",
        resources:{ notes:"Coursecontents/CHE 206/W5.html" },
        pastQuestions:[
          { year:"2017/18", text:"State the four Maxwell's equations and explain the parameters." },
          { year:"2022/23", text:"By applying Maxwell relations and criterion of exactness, prove that (∂H/∂P)T = V − T(∂V/∂T)P." },
          { year:"2022/23", text:"Apply criterion of exactness to derive Maxwell's equations from the fundamental property relations." },
        ],
        practiceQuestions:[
          { q:"State the criterion of exactness. Starting from dG = VdP − SdT, derive the corresponding Maxwell equation.", a:"If dF = Mdx + Ndy, then (∂M/∂y)x = (∂N/∂x)y. For dG: M=V, x=P, N=−S, y=T → (∂V/∂T)P = −(∂S/∂P)T." },
          { q:"State all four Maxwell equations and identify which property relation each comes from.", a:"From dU: (∂T/∂V)S = −(∂P/∂S)V. From dH: (∂T/∂P)S = (∂V/∂S)P. From dA: (∂P/∂T)V = (∂S/∂V)T. From dG: (∂V/∂T)P = −(∂S/∂P)T." },
          { q:"Prove that (∂U/∂V)T = T(∂P/∂T)V − P.", a:"From dU = TdS − PdV, divide by dV at const T: (∂U/∂V)T = T(∂S/∂V)T − P. Apply Maxwell from dA: (∂S/∂V)T = (∂P/∂T)V. Therefore: (∂U/∂V)T = T(∂P/∂T)V − P." },
        ],
        content:{
          "Criterion of Exactness & Maxwell Equations": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W5.html" }
        }
      },
      {
        week:6, topic:"Second Law & Entropy",
        subtopics:["Second Law — Two Statements & Entropy"],
        time:13,
        summary:"The Second Law is about direction. The First Law says energy is conserved but says nothing about which way processes run. The Second Law fills that gap using entropy.",
        resources:{ notes:"Coursecontents/CHE 206/W6.html" },
        pastQuestions:[
          { year:"2015/16", text:"Heat of 120 kJ is transferred directly from a reservoir at 650K to one at 280K. Calculate total entropy change." },
          { year:"2015/16", text:"State the Second Law of Thermodynamics — both statements (Kelvin-Planck and Clausius)." },
          { year:"2016/17", text:"An inventor claims a cyclic engine exchanges heat with reservoirs at 300K and 540K producing 450J of work per 1000J extracted. Is this feasible?" },
        ],
        practiceQuestions:[
          { q:"State both statements of the Second Law. Which statement directly explains why a refrigerator requires a work input?", a:"Kelvin-Planck: impossible to convert heat completely to work in a cycle. Clausius: heat cannot spontaneously flow from cold to hot. Clausius directly explains the refrigerator — moving heat from cold to hot requires work input." },
          { q:"Heat of 120 kJ is transferred from a reservoir at 650K to one at 280K. Calculate total entropy change.", a:"ΔS_hot = −120/650 = −0.1846 kJ/K. ΔS_cold = +120/280 = +0.4286 kJ/K. ΔS_total = +0.244 kJ/K. Positive → irreversible, spontaneous." },
          { q:"An engine operates between 300K and 540K and claims 450J of work per 1000J input. Is this feasible?", a:"Carnot η = 1 − 300/540 = 0.444 = 44.4%. Claimed η = 450/1000 = 45%. Since 45% > 44.4%, this violates Carnot's theorem. Not feasible." },
        ],
        content:{
          "Second Law — Two Statements & Entropy": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W6.html" }
        }
      },
      {
        week:7, topic:"Heat Engines & Carnot Cycle",
        subtopics:["Heat Engines & The Carnot Cycle"],
        time:14,
        summary:"Heat engines convert heat into work. The Carnot engine is the theoretical ideal — the most efficient engine possible between two temperature reservoirs. Every real engine is less efficient than Carnot.",
        resources:{ notes:"Coursecontents/CHE 206/W7.html" },
        pastQuestions:[
          { year:"CHE 206", text:"A heat engine runs on a Carnot cycle with saturated steam at 190 bar in a turbine. Exhaust enters condenser at 10×10⁵ N/m². Show on T-S diagram, calculate quality of steam, work done, and efficiency." },
          { year:"Oyedeko", text:"Define thermal efficiency of a heat engine and express it in terms of heat interactions." },
          { year:"2016/17", text:"List the four processes in a Carnot cycle and describe each." },
        ],
        practiceQuestions:[
          { q:"A reversible engine operates between 537°C and 170.4°C. Calculate its thermal efficiency.", a:"TH = 537+273 = 810K. TC = 170.4+273 = 443.4K. η = 1 − 443.4/810 = 1 − 0.547 = 0.453 = 45.3%." },
          { q:"List the four steps of a Carnot cycle. For each, state whether heat is transferred and whether entropy changes.", a:"1. Isothermal expansion at TH: heat absorbed (QH), entropy increases. 2. Adiabatic expansion: no heat, entropy constant. 3. Isothermal compression at TC: heat rejected (QC), entropy decreases. 4. Adiabatic compression: no heat, entropy constant." },
          { q:"An engine delivers 0.65 kW and rejects heat at 27°C at a rate of 0.50 kW. Calculate efficiency and source temperature.", a:"QH = W + QC = 0.65 + 0.50 = 1.15 kW. η = W/QH = 0.65/1.15 = 56.5%. TC = 300K. TH = TC/(1−η) = 300/0.435 = 690K = 417°C." },
        ],
        content:{
          "Heat Engines & The Carnot Cycle": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W7.html" }
        }
      },
      {
        week:8, topic:"Steam Power Plant & Rankine",
        subtopics:["Why Not Carnot?","The Rankine Cycle"],
        time:14,
        summary:"The Rankine cycle is the practical replacement for the Carnot cycle in real steam power plants. Drawing and explaining the Rankine cycle on a T-S diagram is a guaranteed exam question.",
        resources:{ notes:"Coursecontents/CHE 206/W8.html" },
        pastQuestions:[
          { year:"2022/23", text:"Draw a simple Rankine cycle steam power plant on a T-S diagram indicating boiler, superheater, turbine, condenser, and condensate return pump." },
          { year:"2022/23", text:"Saturated steam at 198 bar drives a turbine (reversible adiabatic). Exhaust enters condenser at 8×10⁵ N/m². Show on T-S diagram, calculate steam quality and work done in turbine." },
          { year:"2015/16", text:"With illustration explain the steam power cycle." },
        ],
        practiceQuestions:[
          { q:"State two reasons why the Rankine cycle is preferred over the Carnot cycle for steam power plants.", a:"1. Carnot with wet steam causes turbine blade erosion — Rankine avoids this by superheating. 2. Carnot requires pumping a wet mixture which is mechanically difficult — Rankine fully condenses to liquid first." },
          { q:"In a power cycle: boiler heat = 3000 kJ/kg, turbine work = 900 kJ/kg, compressor work = 250 kJ/kg, pump work = 10 kJ/kg. Calculate cycle efficiency.", a:"Net work = 900 − 250 − 10 = 640 kJ/kg. η = 640/3000 = 21.3%." },
          { q:"Draw and label a Rankine cycle on a T-S diagram. Label all four state points and four processes.", a:"4→1: pump (adiabatic compression of liquid). 1→2: boiler (constant pressure heating, follows saturation curve). 2→3: turbine (adiabatic expansion). 3→4: condenser (constant T and P condensation)." },
        ],
        content:{
          "Why Not Carnot?": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W8.html" },
          "The Rankine Cycle": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W8.html" }
        }
      },
      {
        week:9, topic:"Heat Pumps, Refrigerators & COP",
        subtopics:["Refrigerators, Heat Pumps & COP"],
        time:13,
        summary:"A refrigerator is a heat engine running backwards. Instead of converting heat to work, you put work in to move heat from cold to hot. The measure of performance is COP, not efficiency.",
        resources:{ notes:"Coursecontents/CHE 206/W9.html" },
        pastQuestions:[
          { year:"CHE 206", text:"An engineer designs cold storage at −25°C. Ambient is 35°C. Heat leaks in at 5 kJ/s. Find minimum power required." },
          { year:"Question bank", text:"A refrigerator removes 3 kW operating between 253K and 310K. Find work input." },
          { year:"Oyedeko", text:"Why is Carnot cycle not used in practice? What is a Carnot heat pump/refrigerator?" },
        ],
        practiceQuestions:[
          { q:"Define COP for a refrigerator and a heat pump. Write both formulas in terms of temperatures.", a:"COP_refrigerator = TC/(TH−TC). COP_heat_pump = TH/(TH−TC). Note: COP can be greater than 1." },
          { q:"A refrigerator removes 3 kW and operates between 253K and 310K. Calculate the work input.", a:"COP = TC/(TH−TC) = 253/(310−253) = 253/57 = 4.44. W = QC/COP = 3/4.44 = 0.675 kW." },
          { q:"Cold storage at −25°C, ambient 35°C, heat leaking in at 5 kJ/s. (i) Minimum power? (ii) If actual COP is 60% of Carnot COP, actual power?", a:"TC=248K, TH=308K. COP_Carnot = 248/60 = 4.13. W_min = 5/4.13 = 1.21 kW. Actual COP = 0.6×4.13 = 2.48. W_actual = 5/2.48 = 2.02 kW." },
        ],
        content:{
          "Refrigerators, Heat Pumps & COP": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W9.html" }
        }
      },
      {
        week:10, topic:"Two-Phase Systems & Dryness",
        subtopics:["Dryness Fraction & Wet Vapour Properties"],
        time:14,
        summary:"When a liquid and its vapour coexist at the same temperature and pressure, you are in the two-phase region. The dryness fraction tells you how much of the mixture is vapour. Every steam table problem starts here.",
        resources:{ notes:"Coursecontents/CHE 206/W10.html" },
        pastQuestions:[
          { year:"2017/18", text:"A container has 1 kg of wet vapour of quality x. Derive an expression for the specific volume of wet vapour." },
          { year:"2022/23", text:"A 0.20 m³ pressure cooker boils water at 4 bar with 0.65 kg of liquid-water vapour mixture. Find quality and mass of liquid present." },
          { year:"2016/17", text:"Steam at 550 kPa and quality 92% occupies 0.4 m³. Find mass, internal energy, and enthalpy." },
        ],
        practiceQuestions:[
          { q:"Define dryness fraction. A wet vapour has x = 0.75 at 5 bar. At 5 bar: vf = 0.001093, vg = 0.3749 m³/kg. Calculate specific volume.", a:"v = vf + x(vg−vf) = 0.001093 + 0.75×(0.3749−0.001093) = 0.001093 + 0.2807 = 0.2818 m³/kg." },
          { q:"A pressure cooker (0.20 m³) at 4 bar contains 0.65 kg of wet mixture. At 4 bar: vf = 0.001084, vg = 0.4625 m³/kg. Find quality and mass of liquid.", a:"v = 0.20/0.65 = 0.3077 m³/kg. x = (v−vf)/(vg−vf) = (0.3077−0.001084)/0.4614 = 0.665. Mass liquid = (1−0.665)×0.65 = 0.218 kg." },
          { q:"When current is reversed in an inductor, why is dI = 2I and not I?", a:"N/A for this course — this is a thermodynamics course. Disregard this question." },
        ],
        content:{
          "Dryness Fraction & Wet Vapour Properties": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W10.html" }
        }
      },
      {
        week:11, topic:"Clapeyron Equation",
        subtopics:["Deriving & Applying the Clapeyron Equation"],
        time:13,
        summary:"The Clapeyron equation connects vapour pressure, temperature, and latent heat. It lets you calculate latent heat from measurable vapour-pressure data without a calorimeter.",
        resources:{ notes:"Coursecontents/CHE 206/W11.html" },
        pastQuestions:[
          { year:"2016/17", text:"Using Gibbs energy, derive the Clapeyron equation. Then estimate latent heat of vaporisation for benzene at 340K." },
          { year:"CHE 206", text:"A vapour pressure equation is given as ln(Psat/Pa) = 20.9042 − 3456.8/(t/K). Estimate latent heat of vaporisation at 378K. vg = 2.541 m³/kg, vf = 0.002 m³/kg." },
          { year:"2022/23", text:"Explain what made possible the derivation of the Clapeyron equation." },
        ],
        practiceQuestions:[
          { q:"State the Clapeyron equation and define all terms. What physical principle makes its derivation possible?", a:"dPsat/dT = ΔH/(TΔV). ΔH = latent heat, ΔV = volume change, T = absolute temperature. Derivation is possible because Gibbs energy is equal for both phases at equilibrium (Gα = Gβ)." },
          { q:"Estimate latent heat for benzene at 340K: Psat(340K) = 66.15 kPa, Psat(350K) = 91.62 kPa, vf = 0.0012 m³/kg, vg = 2.5332 m³/kg.", a:"dPsat/dT ≈ (91620−66150)/(350−340) = 25470/10 = 2547 Pa/K. ΔV = 2.5332−0.0012 = 2.532 m³/kg. ΔH = T×ΔV×dPsat/dT = 340×2.532×2547 = 2,192,000 J/kg ≈ 2192 kJ/kg." },
          { q:"The Clapeyron equation gives dPsat/dT = ΔH/(TΔV). For a liquid-vapour system, ΔV ≈ vg. Why is this approximation valid?", a:"For most substances well below the critical point, vg >> vf. For example at 1 bar, vg ≈ 1.67 m³/kg while vf ≈ 0.001 m³/kg. The error from ignoring vf is less than 0.1%." },
        ],
        content:{
          "Deriving & Applying the Clapeyron Equation": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W11.html" }
        }
      },
      {
        week:12, topic:"Steam Tables — Full Guide",
        subtopics:["How to Use Steam Tables"],
        time:14,
        summary:"Steam tables are a tool, not a topic. This week teaches you exactly how to use them — which table to open, how to read values, how to interpolate, and how to solve the three main exam problem types.",
        resources:{ notes:"Coursecontents/CHE 206/W12.html" },
        pastQuestions:[
          { year:"2022/23", text:"Use steam tables to find: (i) specific volume at 3.7 bar, u = 1200 kJ/kg (ii) specific enthalpy at 1.0 MPa, 250°C." },
          { year:"2017/18", text:"Use steam tables to find dryness fraction at 2 bar with specific enthalpy h = 2340 kJ/kg." },
          { year:"CHE 206", text:"Devise a method to obtain values for saturated vapour at 20 kPa by interpolation from a table giving values at 10 kPa and 30 kPa." },
        ],
        practiceQuestions:[
          { q:"Water is at P = 10 bar and T = 250°C. At 10 bar, Tsat = 179.9°C. Which table do you use? Find specific enthalpy.", a:"T > Tsat → superheated steam. Use superheated table at 10 bar, 250°C. h = 2943 kJ/kg." },
          { q:"Steam at 1 bar has h = 2340 kJ/kg. At 1 bar: hf = 417 kJ/kg, hfg = 2258 kJ/kg. Find dryness fraction.", a:"x = (h−hf)/hfg = (2340−417)/2258 = 1923/2258 = 0.852." },
          { q:"Water at P = 4 bar, u = 1250 kJ/kg. At 4 bar: uf = 603 kJ/kg, ug = 2552 kJ/kg, vf = 0.001084, vfg = 0.4614 m³/kg. Find phase, x, and specific volume.", a:"uf < u < ug → wet vapour. x = (u−uf)/(ug−uf) = (1250−603)/1949 = 0.332. v = vf + x×vfg = 0.001084 + 0.332×0.4614 = 0.154 m³/kg." },
        ],
        content:{
          "How to Use Steam Tables": { hasContent: true, htmlFile: "Coursecontents/CHE 206/W12.html" }
        }
      },
    ]
  },

  "ECE 203": {
    title: "Applied Electricity",
    // FULL CONTENT — reviewed and ready
    weeks: [
      { week:1, topic:"Electric Charge, Coulomb's Law & Electric Field", subtopics:["Electric Charge","Coulomb's Law","Electric Field, Flux & Permittivity"], time:14, content:{
        "Electric Charge": { hasContent: true, htmlFile: "ece203.html#week1" },
        "Coulomb's Law": { hasContent: true, htmlFile: "ece203.html#week1" },
        "Electric Field, Flux & Permittivity": { hasContent: true, htmlFile: "ece203.html#week1" }
      }},
      { week:2, topic:"Electric Potential, Work & Field-Potential Relationship", subtopics:["Electric Potential & Work Done"], time:13, content:{
        "Electric Potential & Work Done": { hasContent: true, htmlFile: "ece203.html#week2" }
      }},
      { week:3, topic:"Current Electricity", subtopics:["Electric Current — From Electrons to Amperes","Ohm's Law, Resistance & Power"], time:14, content:{
        "Electric Current — From Electrons to Amperes": { hasContent: true, htmlFile: "ece203.html#week3" },
        "Ohm's Law, Resistance & Power": { hasContent: true, htmlFile: "ece203.html#week3" }
      }},
      { week:4, topic:"Magnetic Field — Flux, Flux Density & Magnetic Circuits", subtopics:["Magnetic Flux & The Electric-Magnetic Analogy"], time:13, content:{
        "Magnetic Flux & The Electric-Magnetic Analogy": { hasContent: true, htmlFile: "ece203.html#week4" }
      }},
      { week:5, topic:"Electromagnetic Induction", subtopics:["Faraday's Law — Changing Flux Generates EMF"], time:14, content:{
        "Faraday's Law — Changing Flux Generates EMF": { hasContent: true, htmlFile: "ece203.html#week5" }
      }},
      { week:6, topic:"Inductance", subtopics:["Self-Inductance, Mutual Inductance & Series Combinations"], time:13, content:{
        "Self-Inductance, Mutual Inductance & Series Combinations": { hasContent: true, htmlFile: "ece203.html#week6" }
      }},
      { week:7, topic:"Capacitance", subtopics:["Capacitors & Capacitance","Energy Stored in a Capacitor"], time:13 },
      { week:8, topic:"AC Fundamentals I", subtopics:["Sinusoidal Waveforms","RMS & Peak Values"], time:13 },
      { week:9, topic:"AC Fundamentals II", subtopics:["Phasors","Impedance in AC Circuits"], time:14 },
      { week:10, topic:"AC Circuit Analysis", subtopics:["Series RLC Circuits","Parallel RLC Circuits"], time:14 },
      { week:11, topic:"Power in AC Circuits", subtopics:["Active, Reactive & Apparent Power","Power Factor Correction"], time:13 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Question Walkthrough","Key Formulas"], time:10 },
    ]
  },

  "ECE 301": {
    title: "Signals & Systems",
    weeks: [
      { week:1, topic:"Introduction to Signals", subtopics:["Types of Signals","Signal Properties"], time:12 },
      { week:2, topic:"Laplace Transform — First Order ODE", subtopics:["Definition & Properties","Solving First Order ODEs"], time:15 },
      { week:3, topic:"Laplace Transform — Second Order ODE", subtopics:["Solving Second Order ODEs","Inverse Laplace"], time:15 },
      { week:4, topic:"Network Theorems — Superposition", subtopics:["Superposition Principle","Worked Examples"], time:12 },
      { week:5, topic:"Network Theorems — Thevenin & Norton", subtopics:["Thevenin's Theorem","Norton's Theorem","Equivalence"], time:14 },
      { week:6, topic:"Network Theorems — Millman's", subtopics:["Millman's Theorem","Applications"], time:10 },
      { week:7, topic:"Fourier Series — Introduction", subtopics:["Periodic Signals","Fourier Coefficients"], time:14 },
      { week:8, topic:"Fourier Series — Graph Method", subtopics:["Symmetry Conditions","Graph Analysis"], time:12 },
      { week:9, topic:"Fourier Series — Integration Method", subtopics:["Integration Approach","Complex Form"], time:13 },
      { week:10, topic:"Z-Transform", subtopics:["Definition","Properties","Inverse Z-Transform"], time:14 },
      { week:11, topic:"Discrete-Time Systems", subtopics:["DT Signals","DT Convolution"], time:12 },
      { week:12, topic:"Revision & Exam Prep", subtopics:["Past Question Walkthrough","Key Formulas"], time:10 },
    ]
  },

  // ── GENERATE STUBS FOR REMAINING COURSES ────────────────────
  // These are auto-generated 12-week structures.
  // Replace with real content as coordinators review each course.
};

// ── generateCourseStubs ─────────────────────────────────────
// Called by learn.html after both courses.js and courseContent.js load.
// Fills in any course not manually defined with a 12-week placeholder.
window.generateCourseStubs = function() {
  const db = window.coursesDatabase;
  if (!db) return;
  const allCodes = Object.values(db["Faculty of Engineering"] || {})
    .flatMap(dept => Object.values(dept)
      .flatMap(level => Object.values(level)
        .flat()
        .filter(Boolean)
      )
    );
  const uniqueCodes = [...new Set(allCodes)];
  uniqueCodes.forEach(code => {
    if (UNIFY_COURSE_CONTENT[code]) return;
    UNIFY_COURSE_CONTENT[code] = {
      title: code + " — Content coming soon",
      _stub: true,
      weeks: Array.from({length: 12}, (_, i) => ({
        week: i + 1,
        topic: `Week ${i + 1} — ${code}`,
        subtopics: [`Topic ${i + 1}.1 — Theory`, `Topic ${i + 1}.2 — Practice`],
        time: 12
      }))
    };
  });
};


// ── WEEK RESOURCES ────────────────────────────────────────────
// Each week entry can optionally have a `resources` object:
// resources: { outline: "url", notes: "url", pastQuestions: "url" }
// If not set, the learn page falls back to course-level resources from courses.js.
window.getWeekResources = function(courseCode, weekIndex) {
  const course = UNIFY_COURSE_CONTENT[courseCode];
  if (!course || !course.weeks[weekIndex]) return {};
  return course.weeks[weekIndex].resources || {};
};

// ── LOOKUP FUNCTION ──────────────────────────────────────────
// Returns the week structure for a course code.
// Falls back to a generic structure if not found.
window.getCourseContent = function(courseCode) {
  return UNIFY_COURSE_CONTENT[courseCode] || null;
};

// ── CONTENT STATUS ───────────────────────────────────────────
// Returns true if a topic has full reviewed content ready.
window.topicHasContent = function(courseCode, topicName) {
  const course = UNIFY_COURSE_CONTENT[courseCode];
  if (!course) return false;
  for (const week of course.weeks) {
    if (week.content && week.content[topicName]) {
      return week.content[topicName].hasContent;
    }
  }
  return false;
};

// ── CONTENT FILE LINK ─────────────────────────────────────────
// Returns the HTML file link for a topic that has full content.
window.getTopicContentFile = function(courseCode, topicName) {
  const course = UNIFY_COURSE_CONTENT[courseCode];
  if (!course) return null;
  for (const week of course.weeks) {
    if (week.content && week.content[topicName]) {
      return week.content[topicName].htmlFile || null;
    }
  }
  return null;
};

window.UNIFY_COURSE_CONTENT = UNIFY_COURSE_CONTENT;