# ============================================================================
# LifeOS Infrastructure - Terraform Configuration
# Provisions: PostgreSQL, Redis, Neo4j, Pinecone
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "lifeos-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "lifeos-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "LifeOS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================================================
# Variables
# ============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "lifeos"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ============================================================================
# VPC & Networking
# ============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  
  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
  
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Enable VPC endpoints for AWS services
  enable_s3_endpoint       = true
  enable_dynamodb_endpoint = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# ============================================================================
# EKS Cluster
# ============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"
  
  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  # Cluster endpoint access
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true
  
  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
  
  # Node groups
  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.medium"]
      
      min_size     = 3
      max_size     = 10
      desired_size = 3
      
      disk_size = 50
      
      labels = {
        role = "general"
      }
      
      tags = {
        Name = "${var.project_name}-${var.environment}-general"
      }
    }
    
    memory_optimized = {
      name           = "memory-optimized"
      instance_types = ["r5.large"]
      
      min_size     = 2
      max_size     = 5
      desired_size = 2
      
      disk_size = 100
      
      labels = {
        role = "memory-optimized"
      }
      
      taints = [
        {
          key    = "workload"
          value  = "memory-intensive"
          effect = "NoSchedule"
        }
      ]
      
      tags = {
        Name = "${var.project_name}-${var.environment}-memory"
      }
    }
  }
  
  # Manage aws-auth configmap
  manage_aws_auth_configmap = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-eks"
  }
}

# ============================================================================
# RDS PostgreSQL
# ============================================================================

module "postgresql" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"
  
  identifier = "${var.project_name}-${var.environment}-postgres"
  
  engine               = "postgres"
  engine_version       = "15.4"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.t3.medium"
  
  allocated_storage     = 100
  max_allocated_storage = 500
  storage_encrypted     = true
  
  db_name  = "lifeos"
  username = "lifeos_admin"
  port     = 5432
  
  # Generate random password
  manage_master_user_password = true
  
  # Multi-AZ for high availability
  multi_az = true
  
  # Subnet group
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.postgresql.id]
  
  # Backup configuration
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  
  # Performance insights
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  
  # Delete protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-postgres-final-snapshot"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

# Security group for PostgreSQL
resource "aws_security_group" "postgresql" {
  name_description = "${var.project_name}-${var.environment}-postgres-sg"
  vpc_id          = module.vpc.vpc_id
  
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks
    description = "PostgreSQL access from EKS"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-sg"
  }
}

# ============================================================================
# ElastiCache Redis
# ============================================================================

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet"
  subnet_ids = module.vpc.database_subnets
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-subnet"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  replication_group_description = "Redis cluster for LifeOS"
  
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2
  port                 = 6379
  
  # Automatic failover
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  
  # Subnet and security groups
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_window         = "03:00-04:00"
  snapshot_retention_limit = 5
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# Security group for Redis
resource "aws_security_group" "redis" {
  name_description = "${var.project_name}-${var.environment}-redis-sg"
  vpc_id          = module.vpc.vpc_id
  
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks
    description = "Redis access from EKS"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  }
}

# CloudWatch log group for Redis
resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}-redis"
  retention_in_days = 7
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-logs"
  }
}

# ============================================================================
# Neo4j on EKS (via Helm)
# ============================================================================

resource "helm_release" "neo4j" {
  name       = "neo4j"
  repository = "https://helm.neo4j.com/neo4j"
  chart      = "neo4j"
  version    = "5.13.0"
  namespace  = "lifeos"
  
  values = [
    yamlencode({
      neo4j = {
        name     = "lifeos-neo4j"
        edition  = "community"
        password = random_password.neo4j_password.result
        
        resources = {
          requests = {
            cpu    = "500m"
            memory = "2Gi"
          }
          limits = {
            cpu    = "2000m"
            memory = "4Gi"
          }
        }
      }
      
      volumes = {
        data = {
          mode = "dynamic"
          dynamic = {
            storageClassName = "gp3"
            requests = {
              storage = "100Gi"
            }
          }
        }
      }
      
      services = {
        neo4j = {
          enabled = true
          type    = "ClusterIP"
        }
      }
      
      config = {
        "dbms.memory.heap.initial_size" = "1G"
        "dbms.memory.heap.max_size"     = "2G"
        "dbms.memory.pagecache.size"    = "1G"
      }
    })
  ]
  
  depends_on = [module.eks]
}

# Random password for Neo4j
resource "random_password" "neo4j_password" {
  length  = 32
  special = true
}

# Store Neo4j password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "neo4j_password" {
  name = "${var.project_name}/${var.environment}/neo4j-password"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-neo4j-password"
  }
}

resource "aws_secretsmanager_secret_version" "neo4j_password" {
  secret_id     = aws_secretsmanager_secret.neo4j_password.id
  secret_string = random_password.neo4j_password.result
}

# ============================================================================
# Pinecone (External API - Store credentials only)
# ============================================================================

# Store Pinecone API key in AWS Secrets Manager
resource "aws_secretsmanager_secret" "pinecone" {
  name = "${var.project_name}/${var.environment}/pinecone"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-pinecone"
  }
}

resource "aws_secretsmanager_secret_version" "pinecone" {
  secret_id = aws_secretsmanager_secret.pinecone.id
  secret_string = jsonencode({
    api_key     = var.pinecone_api_key
    environment = var.pinecone_environment
    index_name  = var.pinecone_index_name
  })
}

variable "pinecone_api_key" {
  description = "Pinecone API key"
  type        = string
  sensitive   = true
}

variable "pinecone_environment" {
  description = "Pinecone environment"
  type        = string
  default     = "us-east-1-aws"
}

variable "pinecone_index_name" {
  description = "Pinecone index name"
  type        = string
  default     = "lifeos-vectors"
}

# ============================================================================
# Outputs
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "postgresql_endpoint" {
  description = "PostgreSQL endpoint"
  value       = module.postgresql.db_instance_endpoint
  sensitive   = true
}

output "postgresql_master_password_secret_arn" {
  description = "ARN of secret containing PostgreSQL master password"
  value       = module.postgresql.db_instance_master_user_secret_arn
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_auth_token_secret_arn" {
  description = "ARN of secret containing Redis auth token"
  value       = aws_elasticache_replication_group.redis.auth_token
  sensitive   = true
}

output "neo4j_password_secret_arn" {
  description = "ARN of secret containing Neo4j password"
  value       = aws_secretsmanager_secret.neo4j_password.arn
  sensitive   = true
}

output "pinecone_secret_arn" {
  description = "ARN of secret containing Pinecone credentials"
  value       = aws_secretsmanager_secret.pinecone.arn
  sensitive   = true
}
