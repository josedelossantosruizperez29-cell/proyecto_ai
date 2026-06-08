using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Proyecto_ai.Models
{
    public class User
    {
         public long Id { get; set; }
        public string Nombre { get; set; }=string.Empty;
        public string Apellido { get; set; }=string.Empty;
        public string Correo { get; set; }=string.Empty;
        public string PasswordHash { get; set; }=string.Empty;
        public DateTime CreatedAt=DateTime.Now;
    }
}