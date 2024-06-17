const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const PORT = process.env.PORT || 4000;

let rooms = {};
app.get('/', (req, res) => {
    res.send('Hello World');
  });
  
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      board: [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
      ],
      Xturn: true,
      wasExpanded:false,
      winner: '',
      players: {
        X: socket.id,
        O: null
      },
      score:{
        X:0,
        O:0
      },
      full:false
    };
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size < 2) {
        rooms[roomId].players.O = socket.id;
        socket.join(roomId);
        socket.emit('startGame');
        if (room.size === 2) {
          io.to(roomId).emit('startGame');
        }
      } else {
        socket.emit('roomFull');
      }
    } else {
      socket.emit('roomNotFound');
    }
  });

  socket.on('makeMove', ({ roomId, row, col }) => {
    const game = rooms[roomId];
    const currentPlayer = game.Xturn ? 'X' : 'O';
    if (socket.id === game.players[currentPlayer] && game.board[row][col] === '' && game.winner === '') {
      game.board[row][col] = currentPlayer;
      game.Xturn = !game.Xturn;
      game.winner = checkWinner(game.board);
      
      if(isBoardFull(game.board) && game.wasExpanded === false){
        console.log('REMIS')
        game.board = expandBoard(game.board)
        game.wasExpanded === true
      }
      if(game.winner === 'X'){
        game.score.X++
        console.log('X wygral')
      }else if(game.winner === 'O'){
        game.score.O++
        console.log('O wygral')
      }
      io.to(roomId).emit('updateRoom', game);
    }
  });

  socket.on('resetRoomBoard', (roomId) => {
      rooms[roomId].board = [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
      ];
      rooms[roomId].Xturn = true;
      rooms[roomId].winner = '';
      io.to(roomId).emit('updateRoom', rooms[roomId]);
      console.log('reset')
  });
  

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    for (const roomId in rooms) {
      if (rooms[roomId].players.X === socket.id || rooms[roomId].players.O === socket.id) {
        io.to(roomId).emit('opponentDisconnected');
        delete rooms[roomId];
      }
    }
  });
});

function isBoardFull(board) {
  for (let row of board) {
    for (let cell of row) {
      if (cell === '') {
        return false;
      }
    }
  }
  return true;
}
function expandBoard(oldBoard) {
  const oldSize = oldBoard.length;
  const newSize = oldSize + 2;
  const newBoard = Array(newSize).fill('').map(() => Array(newSize).fill(''));

  for (let i = 0; i < oldSize; i++) {
    for (let j = 0; j < oldSize; j++) {
      newBoard[i + 1][j + 1] = oldBoard[i][j];
    }
  }

  console.log('expand!');
  return newBoard;
}
function checkWinner(board) {
  for (let i = 0; i < 3; i++) {
    if (board[i][0] === board[i][1] && board[i][1] === board[i][2] && board[i][0] !== '') {
      return board[i][0];
    }
    if (board[0][i] === board[1][i] && board[1][i] === board[2][i] && board[0][i] !== '') {
      return board[0][i];
    }
  }
  if (board[0][0] === board[1][1] && board[1][1] === board[2][2] && board[0][0] !== '') {
    return board[0][0];
  }
  if (board[0][2] === board[1][1] && board[1][1] === board[2][0] && board[0][2] !== '') {
    return board[0][2];
  }
  return '';
}

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
