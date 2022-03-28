const express = require('express');
// untuk keamanan password
const bcrypt = require('bcryptjs');
// untuk mengatur durasi user login
const session = require('express-session');
// untuk memunculkan alert
const flash = require('express-flash');

// menghubungkan server ke database
const db = require('./connection/db');
// untuk menguplaud file gambar
const upload = require('./middlewares/uploadFile')

db.connect(function (err, _, done) {
  if (err) throw err;

  console.log('Database has Connected');
  done();
});

const app = express();
const PORT = 5000;

// untuk mengatur tampilan ketika login 
// const isLogin = false;

let projects = [];

// untuk menggunakan hbs
app.set('view engine', 'hbs');

app.use(flash())

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'keyboard cat',
  cookie: {maxAge: 1000 * 60 * 60 *2}
}));

//untuk memberi tahu akses folder public agar klien dapat mengakses folder public
app.use('/public', express.static(__dirname + '/public'));
app.use('/uploads', express.static(__dirname + '/upload'));
//
app.use(express.urlencoded({ extended: false }));

//untuk mengambil data 
app.get('/', function (req, res) {
  console.log('User Session Login: ', req.session.isLogin ? true : false);
  console.log('User : ', req.session.user ? req.session.user : {});
  
  db.connect(function(err, client, done){
    // let query = '';
    // query = `SELECT tb_project.*, tb_user.id AS "user_id", tb_user.name, tb_user.email
    //           FROM tb_project LEFT JOIN tb_user
    //           ON tb_user.id = tb_project.author_id`;
    let query = '';
    if (req.session.isLogin) {
      query = `SELECT tb_project.*, tb_user.id AS "user_id", tb_user.name, tb_user.email 
                FROM tb_project LEFT JOIN tb_user 
                ON tb_user.id = tb_project.author_id WHERE tb_user.id=${req.session.user.id} ORDER BY tb_project.id ASC`;
    } else {
      query = `SELECT tb_project.*, tb_user.id AS "user_id", tb_user.name, tb_user.email 
                FROM tb_project LEFT JOIN tb_user 
                ON tb_user.id = tb_project.author_id ORDER BY tb_project.id ASC`;
    }
    if (err) throw err;
    // const query = `SELECT * FROM tb_project`;
    client.query(query, function(err, result){
      if (err) throw err;
      done();
      // console.log(result.rows);

      let dataProject = result.rows.map(function(data){
        let user_id = data.user_id;
        let name = data.name;
        let email = data.email;

        delete data.user_id;
        delete data.name;
        delete data.email;

        const PATH = 'http://localhost:5000/uploads/';

        return{
          ...data,
          time: getDuration(data.startdateproject, data.enddateproject),
          author: {
            user_id,
            name,
            email,
          },
          isLogin: req.session.isLogin,
          image: PATH + data.image,
        };
      });
      // console.log(dataProject)
      // projects.push(dataProject);
      res.render('index', {user: req.session.user, isLogin: req.session.isLogin, projects: dataProject});
    });
    // console.log('connection success');
  });
});

app.get('/my-project', function (req, res){
  res.render('my-project');
})

app.get('/login', function (req, res) {
  res.render('login');
});

app.post('/login', function (req, res){
  const data = req.body;

  if (data.email == "" || data.password == ""){
    req.flash("error", "Please insert all field!");
    return res.redirect('/login');
  }

    db.connect(function(err, client, done){
      if(err) throw err;
      const query = `SELECT * FROM tb_user WHERE email = '${data.email}'`;

    client.query(query, function (err, result) {
      if (err) throw err;

      // Check account by email
      if (result.rows.length == 0) {
        console.log('Email not found!');
        return res.redirect('/login');
      }

      // Check password
      const isMatch = bcrypt.compareSync(
        data.password,
        result.rows[0].password
      );

      if (isMatch == false) {
        console.log('Wrong Password!');
        return res.redirect('/login');
      }

      req.session.isLogin = true;
      req.session.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
      };

        res.redirect('/');
      });
    });
});

app.get('/register', function (req, res) {
  res.render('register');
});

app.post('/register', function (req, res) {
  const data = req.body;

  if (data.name == '' || data.email == '' || data.password == '') {
    req.flash('error', 'Please insert all field!');
    return res.redirect('/register');
  }

  const hashedPassword = bcrypt.hashSync(data.password, 10);

  db.connect(function (err, client, done) {
    if (err) throw err;

    const query = `INSERT INTO tb_user(name,email,password) VALUES ('${data.name}','${data.email}','${hashedPassword}')`;

    client.query(query, function (err, result) {
      if (err) throw err;

      req.flash('success', 'Success register your account!');
      res.redirect('/login');
    });
  });
});

app.get('/projectdetail/:id', function (req, res) {
  let id = req.params.id;

  db.connect(function(err, client, done){
    if (err) throw err;
    done()

    const query = `SELECT * FROM tb_project WHERE id=${id}`;
    client.query(query, function (err, result){
      if (err) throw err;
      console.log(result.rows);
      let data = result.rows[0];
      data = {
        nameproject: data.nameproject,
        startdateproject: renderDate(data.startdateproject),
        enddateproject: renderDate(data.enddateproject),
        description: data.description,
        reactjs: viewCheck(data.reactjs),
        nodejs: viewCheck(data.nodejs),
        nextjs: viewCheck(data.nextjs),
        typescript: viewCheck(data.typescript),
      }
      // console.log(dataProject);
      res.render('projectdetail', {project: data});
    });
  });
});

app.get('/update-project/:id', function (req, res) {
  let id = req.params.id

  db.connect(function (err,client,done){
    if (err) throw err;

    const query = `SELECT * FROM tb_project WHERE id = ${id}`;

    console.log(query);
    client.query(query, function (err, result){
      if (err) throw err;

      let data = result.rows[0];

      data = {
        nameproject: data.nameproject,
        startdateproject: renderDate(data.startdateproject),
        enddateproject: renderDate(data.enddateproject),
        description: data.description,
        reactjs: viewCheck(data.reactjs),
        nodejs: viewCheck(data.nodejs),
        nextjs: viewCheck(data.nextjs),
        typescript: viewCheck(data.typescript),
      }
      
      res.render('update-project',{isLogin: req.session.isLogin, projects:data});

      done();
    });
  });
});

app.get('/delete-project/:id', function (req, res){
  let id = req.params.id;

  db.connect(function(err, client, done){
    if (err) throw err;

    const query = `DELETE FROM tb_project WHERE id=${id}`;

    client.query(query, function(err, result){
      if (err) throw err;
      done();

      res.redirect('/');
    })
  });
});

// post add project
app.post('/my-project', function (req, res){
  // let id = req.params.id;

  let data = req.body;
  // let data = {
  //   nameproject: req.body.nameproject,
  //   startdateproject: req.body.startdateproject,
  //   enddateproject: req.body.enddateproject,
  //   description: req.body.description,
  //   reactjs: req.body.reactjs,
  //   nodejs: req.body.nodejs,
  //   nextjs: req.body.nextjs,
  //   typescript: req.body.typescript,
  //   image: req.body.image,
  // };
  console.log(data);
  db.connect(function(err, client, done){
    if(err) throw err;

    const query = `INSERT INTO tb_project (nameproject, startdateproject, enddateproject, description, reactjs, nodejs, nextjs, typescript, image, author_id)
                    VALUES ('${data.nameproject}', '${data.startdateproject}', '${data.enddateproject}', '${data.description}',
                    ${checkbox(data.reactjs)}, ${checkbox(data.nodejs)}, ${checkbox(data.nextjs)}, ${checkbox(data.typescript)},
                    '${data.image}', '${req.session.user.id}')`;
    console.log(query);
  //   const query = `INSERT INTO tb_project
  //   nameproject = '${data.nameproject}',
  //   startdateproject = '${render(data.startdateproject)}',
  //   endateproject = '${renderDate(data.enddateproject)}',
  //   description = '${data.description}',
  //   reactjs = ${checkboxRender(data.reactjs)},
  //   nodejs = ${checkboxRender(data.nodejs)},
  //   nextjs = ${checkboxRender(data.nextjs)},
  //   typescript = ${checkboxRender(data.typescript)},
  //   image = '${data.image}',
  // WHERE id = ${id}`;

    client.query(query, function (err, result){
      if (err) throw err;
      done();
     
      console.log(result); 
    });
  });
  res.redirect('/');
});

app.post('/update-project/:id', function (req, res) {
  let id = req.params.id;

  let data = req.body;
  console.log(data);
  db.connect(function(err,client,done){
    if(err) throw err;

  //   const query = `UPDATE tb_project SET
  //   nameproject = '${req.body.nameproject}',
  //   startdateproject = '${req.body.startdateproject}',
  //   enddateproject = '${req.body.enddateproject}',
  //   description = '${req.body.description}',
  //   reactjs = ${checkboxRender(req.body.reactjs)},
  //   nodejs = ${checkboxRender(req.body.nodejs)},
  //   nextjs = ${checkboxRender(req.body.nextjs)},
  //   typescript = ${checkboxRender(req.body.typescript)},
  // WHERE id = ${id}`;
    
  const query = `UPDATE tb_project SET
  nameproject = '${data.nameproject}',
  startdateproject = '${data.startdateproject}',
  enddateproject = '${data.enddateproject}',
  description = '${data.description}',
  reactjs = ${checkboxRender(data.reactjs)},
  nodejs = ${checkboxRender(data.nodejs)},
  nextjs = ${checkboxRender(data.nextjs)},
  typescript = ${checkboxRender(data.typescript)},
WHERE id = ${id}`;

    client.query(query, function (err, result){
      if (err) throw err;
      done();
      
      console.log(data);
      res.redirect('/');
    });
  });
});

// app.post('/update-project/:id', function (req, res){
//   let id = req.params.id;

//   let data = req.body;
//   // console.log(data);

//   db.connect(function(err,client,done){
//     if (err) throw err;
//     done()

//     const query = `UPDATE to tb_project SET
//     nameproject = '${data.nameproject}'
//   WHERE id =${id}`;
  
//   client.query(query, function (err, result){
//     if (err) throw err;
    
//   });
//   res.redirect('/my-project');
// });
// });

app.post('/my-project', function (req, res) {

  let data = req.body;

  db.connect(function (err, client, done) {
      if (err) throw err;

      const query = `INSERT INTO tb_project (projectname, startdateproject, enddateproject, description, image, nodejs, nextjs, reactjs, typescript, author_id) 
                      VALUES ('${data.projectname}','${data.startdateproject}','${data.enddateproject}','${data.description}','${req.file.filename}', '${checkbox(data.nodejs)}', '${checkbox(data.nextjs)}', '${checkbox(data.reactjs)}', '${checkbox(data.typescript)}', '${req.session.user.id}')`;

      client.query(query, function (err, result) {
          if (err) throw err;
          done();
          res.redirect('/');
      });
  });
});

app.get('/project-delete/:id', function (req, res) {
  let id = req.params.id;

  db.connect(function (err,client,done){
    if (err) throw err;

    const query = `DELETE FROM tb_project WHERE id=${id};`;

    console.log(query);
    client.query(query, function (err, result){
      if (err) throw err;

      // let data = result.rows[0];

      // data = {
      //   nameproject: render(data.nameproject),
      //   startdateproject: render(data.startdateproject),
      //   enddateproject: render(data.enddateproject),
      //   description: render(data.description),
      //   reactjs: viewCheck(data.reactjs),
      //   nodejs: viewCheck(data.nodejs),
      //   nextjs: viewCheck(data.nextjs),
      //   typescript: viewCheck(data.typescript),
      // }
     

      done();
    });
  });

  res.redirect('/');
});

app.get('/contact', function (req, res) {
  res.render('contact');
});

app.listen(PORT, function () {
  console.log(`Server starting on PORT: ${PORT}`);
});

// duration
function getDuration(startdateproject, enddateproject) {

  // day, month, year
  let time = new Date(enddateproject) - new Date(startdateproject)
  let days = time / (24 * 3600 * 1000)
  let month = 30
  let years = month * 12

  //endDate and startDate
  let dayDistance = Math.floor((days % years) % month) % 7
  let weekDistance = Math.floor(((days % years) % month) / 7)
  let monthDistance = Math.floor((days % years) / month)
  let yearDistance = Math.floor(days / years)

  // Display to innerHTML
   let duration ="";
   if (yearDistance > 0) {
     duration += yearDistance + " tahun ";
      } if (monthDistance > 0) {
        duration += monthDistance + " bulan ";
      } if (weekDistance > 0) {
        duration += weekDistance + " minggu ";
      } if (dayDistance > 0) {
        duration += dayDistance + " hari ";
      }
   return duration;
}

//add project
function checkbox(par1){
  if (par1 == 'true'){
    return true
  } else {
    return false
  }
}

//update project
function checkboxRender(tech1){
  if (tech1 == 'on'){
    return true
  } else if (tech1 != true){
    return false
  }
}

//delete project
function viewCheck(form){
  if (form == true){
    return 'checked'
  }else if (form != true){
    return " "
  }
}

// time
function renderDate(formtime){
  let hari = [
    '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21',
    '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'
  ]
  
  let bulan = [
    '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12',
  ]

  let date = formtime.getDate();
  let monthIndex = formtime.getMonth();
  let year = formtime.getFullYear();

  let getFullTime = `${year}-${bulan[monthIndex]}-${hari[date]}`;

  return getFullTime;
}